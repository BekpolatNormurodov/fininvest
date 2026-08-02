import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { DocumentType, MessageDto, Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from '../documents/storage.service';
import { decodeUploadName } from '../common/upload-name.util';

const msgInclude = {
  sender: true,
  document: { include: { uploadedBy: true } },
  attachments: { include: { uploadedBy: true } },
} as const;

/**
 * A message is visible to: its sender, the user it was directed to (toUserId),
 * everyone (toUserId & toRole both null), or the targeted role (toRole).
 * Directed messages (to a user or role) stay private to those parties.
 */
function visibleTo(user: RequestUser): Prisma.MessageWhereInput {
  return {
    OR: [
      { senderId: user.id },
      { toUserId: user.id },
      { AND: [{ toUserId: null }, { toRole: null }] },
      { AND: [{ toUserId: null }, { toRole: user.role as Role }] },
    ],
  };
}

/** Thread-identity helpers for case-independent DM + Saved threads. */
export const dmPairKey = (a: string, b: string) => [a, b].sort().join(':');
export const dmWhere = (me: string, other: string): Prisma.MessageWhereInput => ({
  caseId: null,
  OR: [
    { senderId: me, toUserId: other },
    { senderId: other, toUserId: me },
  ],
});
export const savedWhere = (me: string): Prisma.MessageWhereInput => ({ caseId: null, senderId: me, toUserId: me });

function docDto(d: any) {
  return {
    id: d.id,
    type: d.type,
    fileName: d.fileName,
    isGenerated: d.isGenerated,
    uploadedAt: d.createdAt.toISOString(),
    uploadedByName: d.uploadedBy?.fullName ?? null,
    mimeType: d.mimeType ?? null,
    url: `/api/documents/${d.id}/download`,
  };
}

@UseGuards(JwtAuthGuard)
@Controller()
class MessagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Directory search — any authenticated user can look up colleagues by role/name. */
  @Get('directory')
  async directory(@Query('role') role?: string, @Query('q') q?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: role ? (role as Role) : undefined,
        fullName: q ? { contains: q } : undefined,
      },
      select: { id: true, fullName: true, role: true, branch: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
      take: 30,
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      branchName: u.branch?.name ?? null,
    }));
  }

  /** Notification feed — recent messages from others, newest first. */
  @Get('messages/feed')
  async feed(@CurrentUser() user: RequestUser) {
    const msgs = await this.prisma.message.findMany({
      where: { AND: [{ senderId: { not: user.id } }, { caseId: { not: null } }, visibleTo(user)] },
      include: { sender: true, case: { select: { number: true } }, document: true, attachments: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return msgs.map((m) => ({
      id: m.id,
      caseId: m.caseId ?? '',
      caseNumber: m.case?.number ?? '',
      senderName: m.sender.fullName,
      senderRole: m.sender.role,
      text: m.text,
      toRole: m.toRole,
      hasFile: !!m.documentId || m.attachments.length > 0,
      read: (m.readBy ?? '').split(',').includes(user.id),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Unread message count across the current user's cases (for the sidebar badge). */
  @Get('messages/unread')
  async unread(@CurrentUser() user: RequestUser) {
    const msgs = await this.prisma.message.findMany({
      where: { AND: [{ senderId: { not: user.id } }, visibleTo(user)] },
      select: { id: true, readBy: true, caseId: true },
    });
    const count = msgs.filter((m) => !(m.readBy ?? '').split(',').includes(user.id)).length;
    return { count };
  }

  /** Unread count grouped by case (for the conversations list badges). */
  @Get('messages/unread-by-case')
  async unreadByCase(@CurrentUser() user: RequestUser) {
    const msgs = await this.prisma.message.findMany({
      where: { AND: [{ senderId: { not: user.id } }, visibleTo(user)] },
      select: { readBy: true, caseId: true },
    });
    const counts = new Map<string, number>();
    for (const m of msgs) {
      if (m.caseId && !(m.readBy ?? '').split(',').includes(user.id)) counts.set(m.caseId, (counts.get(m.caseId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([caseId, count]) => ({ caseId, count }));
  }

  @Get('cases/:id/messages')
  async list(@Param('id') caseId: string, @CurrentUser() user: RequestUser): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: { AND: [{ caseId }, visibleTo(user)] },
      include: msgInclude,
      orderBy: { createdAt: 'asc' },
    });

    // Messages (not mine) that my opening this thread marks as read now.
    const toMarkIds = new Set(
      messages.filter((m) => m.senderId !== user.id && !(m.readBy ?? '').split(',').includes(user.id)).map((m) => m.id),
    );
    // Effective reader set per message = stored readBy (+ my just-now read).
    const readersOf = (m: (typeof messages)[number]): string[] => {
      const set = new Set((m.readBy ?? '').split(',').filter(Boolean));
      if (toMarkIds.has(m.id)) set.add(user.id);
      return [...set].filter((id) => id !== m.senderId);
    };

    // Bulk-resolve names for directed-to targets + everyone who has read a message.
    const idsToResolve = new Set<string>();
    for (const m of messages) {
      if (m.toUserId) idsToResolve.add(m.toUserId);
      for (const r of readersOf(m)) idsToResolve.add(r);
    }
    const users = idsToResolve.size
      ? await this.prisma.user.findMany({ where: { id: { in: [...idsToResolve] } }, select: { id: true, fullName: true } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    if (toMarkIds.size) {
      await Promise.all(
        messages.filter((m) => toMarkIds.has(m.id)).map((m) =>
          this.prisma.message.update({
            where: { id: m.id },
            data: { readBy: [...(m.readBy ?? '').split(',').filter(Boolean), user.id].join(',') },
          }),
        ),
      );
    }

    return messages.map((m) => {
      const docs = [...(m.document ? [m.document] : []), ...m.attachments];
      const readers = readersOf(m);
      return {
        id: m.id,
        caseId: m.caseId ?? '',
        senderId: m.senderId,
        senderName: m.sender.fullName,
        senderRole: m.sender.role,
        text: m.text,
        toRole: m.toRole,
        toUserId: m.toUserId,
        toUserName: m.toUserId ? nameById.get(m.toUserId) ?? null : null,
        mine: m.senderId === user.id,
        readByNames: readers.map((id) => nameById.get(id)).filter(Boolean) as string[],
        editable: m.senderId === user.id && readers.length === 0,
        edited: !!m.editedAt,
        document: m.document ? docDto(m.document) : null,
        documents: docs.map(docDto),
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  @Post('cases/:id/messages')
  @UseInterceptors(FilesInterceptor('files', 3))
  async send(
    @Param('id') caseId: string,
    @CurrentUser() user: RequestUser,
    @Body('text') text: string | undefined,
    @Body('toRole') toRole: string | undefined,
    @Body('toUserId') toUserId: string | undefined,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const created = await this.prisma.message.create({
      data: {
        caseId,
        senderId: user.id,
        text: text || null,
        toRole: toRole ? (toRole as Role) : null,
        toUserId: toUserId || null,
        readBy: user.id,
      },
    });

    if (files?.length) {
      await Promise.all(
        files.map(async (file) => {
          const stored = await this.storage.save(file.buffer, decodeUploadName(file.originalname), file.mimetype, `${caseId}/chat`);
          await this.prisma.document.create({
            data: {
              caseId,
              messageId: created.id,
              type: DocumentType.CHAT,
              fileName: stored.fileName,
              storagePath: stored.storagePath,
              mimeType: stored.mimeType,
              uploadedById: user.id,
            },
          });
        }),
      );
    }
    return { id: created.id };
  }

  // ── DM + Saved threads (case-independent messaging) ──

  /** Map raw messages (with msgInclude) → MessageDto[], marking unread→read for the viewer. */
  private async hydrate(messages: any[], user: RequestUser): Promise<MessageDto[]> {
    const toMarkIds = new Set(
      messages.filter((m) => m.senderId !== user.id && !(m.readBy ?? '').split(',').includes(user.id)).map((m) => m.id),
    );
    const readersOf = (m: any): string[] => {
      const set = new Set<string>((m.readBy ?? '').split(',').filter(Boolean));
      if (toMarkIds.has(m.id)) set.add(user.id);
      return [...set].filter((id) => id !== m.senderId);
    };
    const idsToResolve = new Set<string>();
    for (const m of messages) { if (m.toUserId) idsToResolve.add(m.toUserId); for (const r of readersOf(m)) idsToResolve.add(r); }
    const users = idsToResolve.size
      ? await this.prisma.user.findMany({ where: { id: { in: [...idsToResolve] } }, select: { id: true, fullName: true } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    if (toMarkIds.size) {
      await Promise.all(messages.filter((m) => toMarkIds.has(m.id)).map((m) =>
        this.prisma.message.update({ where: { id: m.id }, data: { readBy: [...(m.readBy ?? '').split(',').filter(Boolean), user.id].join(',') } })));
    }
    return messages.map((m) => {
      const docs = [...(m.document ? [m.document] : []), ...m.attachments];
      const readers = readersOf(m);
      return {
        id: m.id, caseId: m.caseId, senderId: m.senderId, senderName: m.sender.fullName, senderRole: m.sender.role,
        text: m.text, toRole: m.toRole, toUserId: m.toUserId, toUserName: m.toUserId ? nameById.get(m.toUserId) ?? null : null,
        mine: m.senderId === user.id, readByNames: readers.map((id) => nameById.get(id)).filter(Boolean) as string[],
        editable: m.senderId === user.id && readers.length === 0, edited: !!m.editedAt,
        document: m.document ? docDto(m.document) : null, documents: docs.map(docDto), createdAt: m.createdAt.toISOString(),
      };
    });
  }

  /** Create a message (case, DM or saved) + optional attachments. */
  private async createMessage(opts: { senderId: string; caseId: string | null; toUserId: string | null; text?: string; files?: Express.Multer.File[]; dir: string }) {
    const created = await this.prisma.message.create({
      data: { caseId: opts.caseId, senderId: opts.senderId, text: opts.text || null, toUserId: opts.toUserId, readBy: opts.senderId },
    });
    if (opts.files?.length) {
      await Promise.all(opts.files.map(async (file) => {
        const stored = await this.storage.save(file.buffer, decodeUploadName(file.originalname), file.mimetype, opts.dir);
        await this.prisma.document.create({ data: { caseId: opts.caseId, messageId: created.id, type: DocumentType.CHAT, fileName: stored.fileName, storagePath: stored.storagePath, mimeType: stored.mimeType, uploadedById: opts.senderId } });
      }));
    }
    return created.id;
  }

  @Get('dm/:userId/messages')
  async dmList(@Param('userId') other: string, @CurrentUser() user: RequestUser): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({ where: dmWhere(user.id, other), include: msgInclude, orderBy: { createdAt: 'asc' } });
    return this.hydrate(messages, user);
  }

  @Post('dm/:userId/messages')
  @UseInterceptors(FilesInterceptor('files', 3))
  async dmSend(@Param('userId') other: string, @CurrentUser() user: RequestUser, @Body('text') text: string | undefined, @UploadedFiles() files?: Express.Multer.File[]) {
    const id = await this.createMessage({ senderId: user.id, caseId: null, toUserId: other, text, files, dir: `dm/${dmPairKey(user.id, other)}` });
    return { id };
  }

  // ── General (broadcast) channel — everyone, including collectors on mobile ──

  @Get('messages/general')
  async generalList(@CurrentUser() user: RequestUser): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: { caseId: null, toUserId: null, toRole: null },
      include: msgInclude,
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
    return this.hydrate(messages, user);
  }

  @Post('messages/general')
  @UseInterceptors(FilesInterceptor('files', 3))
  async generalSend(@CurrentUser() user: RequestUser, @Body('text') text: string | undefined, @UploadedFiles() files?: Express.Multer.File[]) {
    const id = await this.createMessage({ senderId: user.id, caseId: null, toUserId: null, text, files, dir: 'general' });
    return { id };
  }

  @Get('saved/messages')
  async savedList(@CurrentUser() user: RequestUser): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({ where: savedWhere(user.id), include: msgInclude, orderBy: { createdAt: 'asc' } });
    return this.hydrate(messages, user);
  }

  @Post('saved/messages')
  @UseInterceptors(FilesInterceptor('files', 3))
  async savedSend(@CurrentUser() user: RequestUser, @Body('text') text: string | undefined, @UploadedFiles() files?: Express.Multer.File[]) {
    const id = await this.createMessage({ senderId: user.id, caseId: null, toUserId: user.id, text, files, dir: `saved/${user.id}` });
    return { id };
  }

  /** Copy a message I can see into my Saved thread (text copied; attachments are a follow-up). */
  @Post('messages/:id/save-to-saved')
  async saveToSaved(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const src = await this.prisma.message.findUnique({ where: { id } });
    if (!src) throw new NotFoundException('Xabar topilmadi');
    const visible = src.senderId === user.id || src.toUserId === user.id || (src.toUserId === null && (src.toRole === null || src.toRole === (user.role as Role)));
    if (!visible) throw new ForbiddenException('Ruxsat yo‘q');
    const newId = await this.createMessage({ senderId: user.id, caseId: null, toUserId: user.id, text: src.text ?? undefined, dir: `saved/${user.id}` });
    return { id: newId };
  }

  /** Unified inbox: Saved (pinned) + DM threads + case threads, newest first. */
  @Get('conversations')
  async conversations(@CurrentUser() user: RequestUser) {
    const flat = await this.prisma.message.findMany({ where: { caseId: null, OR: [{ senderId: user.id }, { toUserId: user.id }] }, orderBy: { createdAt: 'desc' } });
    const savedMsgs = flat.filter((m) => m.senderId === user.id && m.toUserId === user.id);
    const saved = { kind: 'saved' as const, key: 'saved', title: 'Saqlangan xabarlar', lastText: savedMsgs[0]?.text ?? null, lastAt: savedMsgs[0]?.createdAt.toISOString() ?? null, unread: 0 };
    const peers = new Map<string, { lastText: string | null; lastAt: string; unread: number }>();
    for (const m of flat) {
      if (m.senderId === user.id && m.toUserId === user.id) continue;
      const peer = m.senderId === user.id ? m.toUserId : m.senderId;
      if (!peer) continue;
      if (!peers.has(peer)) peers.set(peer, { lastText: m.text, lastAt: m.createdAt.toISOString(), unread: 0 });
      if (m.senderId !== user.id && !(m.readBy ?? '').split(',').includes(user.id)) peers.get(peer)!.unread++;
    }
    const peerIds = [...peers.keys()];
    const peerUsers = peerIds.length ? await this.prisma.user.findMany({ where: { id: { in: peerIds } }, select: { id: true, fullName: true } }) : [];
    const nameById = new Map(peerUsers.map((u) => [u.id, u.fullName]));
    const dms = peerIds.map((pid) => ({ kind: 'dm' as const, key: pid, title: nameById.get(pid) ?? 'Foydalanuvchi', ...peers.get(pid)! }));
    const caseMsgs = await this.prisma.message.findMany({ where: { AND: [{ caseId: { not: null } }, visibleTo(user)] }, include: { case: { select: { number: true } } }, orderBy: { createdAt: 'desc' } });
    const caseMap = new Map<string, { kind: 'case'; key: string; title: string; lastText: string | null; lastAt: string; unread: number }>();
    for (const m of caseMsgs) {
      if (!m.caseId) continue;
      if (!caseMap.has(m.caseId)) caseMap.set(m.caseId, { kind: 'case', key: m.caseId, title: `Ariza ${m.case?.number ?? ''}`, lastText: m.text, lastAt: m.createdAt.toISOString(), unread: 0 });
      if (m.senderId !== user.id && !(m.readBy ?? '').split(',').includes(user.id)) caseMap.get(m.caseId)!.unread++;
    }
    const rest = [...dms, ...caseMap.values()].sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    return [saved, ...rest];
  }

  /** Sender-only guard: must own the message and nobody else may have read it. */
  private async ownUnreadMessage(caseId: string, msgId: string, user: RequestUser) {
    const m = await this.prisma.message.findUnique({ where: { id: msgId }, include: { attachments: true } });
    if (!m || m.caseId !== caseId) throw new NotFoundException('Xabar topilmadi');
    if (m.senderId !== user.id) throw new ForbiddenException('Faqat o‘z xabaringizni o‘zgartira olasiz');
    const others = (m.readBy ?? '').split(',').filter(Boolean).filter((id) => id !== user.id);
    if (others.length) throw new BadRequestException('Xabar allaqachon o‘qilgan — o‘zgartirib bo‘lmaydi');
    return m;
  }

  @Patch('cases/:id/messages/:msgId')
  async edit(
    @Param('id') caseId: string,
    @Param('msgId') msgId: string,
    @CurrentUser() user: RequestUser,
    @Body('text') text: string | undefined,
  ) {
    await this.ownUnreadMessage(caseId, msgId, user);
    if (!text || !text.trim()) throw new BadRequestException('Matn bo‘sh bo‘lishi mumkin emas');
    await this.prisma.message.update({ where: { id: msgId }, data: { text: text.trim(), editedAt: new Date() } });
    return { ok: true };
  }

  @Delete('cases/:id/messages/:msgId')
  async remove(@Param('id') caseId: string, @Param('msgId') msgId: string, @CurrentUser() user: RequestUser) {
    const m = await this.ownUnreadMessage(caseId, msgId, user);
    const docIds = [...m.attachments.map((d) => d.id), ...(m.documentId ? [m.documentId] : [])];
    if (docIds.length) await this.prisma.document.deleteMany({ where: { id: { in: docIds } } });
    await this.prisma.message.delete({ where: { id: msgId } });
    return { ok: true };
  }
}

@Module({ controllers: [MessagesController] })
export class MessagesModule {}
