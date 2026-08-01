import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CollectionStatus,
  Role,
  collectionStats,
  collectionTotal,
  type CollectionDto,
  type CollectionListItem,
  type CollectionStats,
} from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/current-user.decorator';
import {
  canDeleteCollection,
  canManageCollection,
  collectionNotifications,
  collectionScopeWhere,
  type CollectionEventKind,
  type CollectionNotifyCtx,
  type NotificationSeed,
} from './collection-access';
import {
  collectionDetailInclude,
  collectionListInclude,
  toCollectionDto,
  toCollectionListItem,
} from './collection.mapper';
import { CreateCollectionDto, UpdateCollectionDto } from './dto';

export interface CollectionListFilters {
  status?: CollectionStatus;
  collectorId?: string;
  branchId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── scoping ───────────────────────────────────────────────────────────────

  private async scopeWhere(user: RequestUser): Promise<Prisma.CollectionWhereInput> {
    let branchIds: string[] = [];
    if (user.role === Role.MODERATOR) {
      const assigned = await this.prisma.branch.findMany({
        where: { moderators: { some: { id: user.id } } },
        select: { id: true },
      });
      branchIds = assigned.map((b) => b.id);
    } else if (user.role === Role.COLLECTOR) {
      const covered = await this.prisma.branch.findMany({
        where: { collectors: { some: { id: user.id } } },
        select: { id: true },
      });
      branchIds = covered.map((b) => b.id);
    }
    return collectionScopeWhere(user.role, user.id, branchIds);
  }

  private applyFilters(where: Prisma.CollectionWhereInput, f: CollectionListFilters): Prisma.CollectionWhereInput {
    const out: Prisma.CollectionWhereInput = { ...where };
    if (f.status) out.status = f.status;
    if (f.collectorId) out.assignedCollectorId = f.collectorId;
    if (f.branchId) out.case = { ...(out.case as object), branchId: f.branchId };
    if (f.from || f.to) {
      out.createdAt = {
        ...(f.from ? { gte: new Date(f.from) } : {}),
        ...(f.to ? { lte: endOfDay(f.to) } : {}),
      };
    }
    return out;
  }

  // ── reads ─────────────────────────────────────────────────────────────────

  async list(user: RequestUser, filters: CollectionListFilters = {}): Promise<CollectionListItem[]> {
    const where = this.applyFilters(await this.scopeWhere(user), filters);
    const rows = await this.prisma.collection.findMany({
      where,
      include: collectionListInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toCollectionListItem);
  }

  async stats(user: RequestUser, filters: CollectionListFilters = {}): Promise<CollectionStats> {
    return collectionStats(await this.list(user, filters));
  }

  async get(user: RequestUser, id: string): Promise<CollectionDto> {
    const scope = await this.scopeWhere(user);
    const c = await this.prisma.collection.findFirst({
      where: { AND: [{ id }, scope] },
      include: collectionDetailInclude,
    });
    if (!c) throw new NotFoundException('Undiruv topilmadi');
    return toCollectionDto(c);
  }

  /** The active (unclosed) collection for a case, or the most recent one — powers the case-page panel. */
  async forCase(user: RequestUser, caseId: string): Promise<CollectionDto | null> {
    const scope = await this.scopeWhere(user);
    const c = await this.prisma.collection.findFirst({
      where: { AND: [{ caseId }, scope] },
      include: collectionDetailInclude,
      orderBy: [{ closedAt: 'asc' }, { createdAt: 'desc' }], // unclosed (closedAt null) first
    });
    return c ? toCollectionDto(c) : null;
  }

  // ── writes ──────────────────────────────────────────────────────────────────

  async create(user: RequestUser, dto: CreateCollectionDto): Promise<CollectionDto> {
    if (!canManageCollection(user.role)) throw new ForbiddenException('Undiruv yaratishga ruxsat yo‘q');

    const kase = await this.prisma.creditCase.findUnique({
      where: { id: dto.caseId },
      select: { id: true, number: true, branchId: true, createdById: true, borrower: { select: { fullName: true } } },
    });
    if (!kase) throw new NotFoundException('Ariza topilmadi');
    await this.assertCaseInScope(user, kase.branchId);

    // One active (unclosed) collection per case.
    const open = await this.prisma.collection.count({ where: { caseId: kase.id, status: { not: CollectionStatus.CLOSED } } });
    if (open > 0) throw new ConflictException('Bu arizada faol undiruv allaqachon mavjud');

    const collectorId = await this.resolveCollector(dto.assignedCollectorId);
    const penalty = dto.penalty ?? 0;
    const fine = dto.fine ?? 0;
    const totalDebt = collectionTotal({ months: dto.months, penalty, fine });

    const created = await this.prisma.collection.create({
      data: {
        caseId: kase.id,
        status: collectorId ? CollectionStatus.ASSIGNED : CollectionStatus.NEW,
        penalty,
        fine,
        totalDebt,
        note: dto.note ?? null,
        createdById: user.id,
        assignedCollectorId: collectorId,
        assignedById: collectorId ? user.id : null,
        assignedAt: collectorId ? new Date() : null,
        months: {
          create: dto.months.map((m) => ({
            year: m.year,
            month: m.month,
            amount: m.amount,
            plannedAmount: m.amount, // UI defaults it from the schedule; stored as the reference
          })),
        },
      },
      include: collectionDetailInclude,
    });

    const ctx: CollectionNotifyCtx = {
      caseId: kase.id,
      caseNumber: kase.number,
      borrowerName: kase.borrower?.fullName ?? null,
      operatorId: kase.createdById,
      collectorId,
      actorId: user.id,
    };
    await this.notify('created', ctx);
    if (collectorId) await this.notify('assigned', ctx);

    return toCollectionDto(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateCollectionDto): Promise<CollectionDto> {
    if (!canManageCollection(user.role)) throw new ForbiddenException('Undiruvni tahrirlashga ruxsat yo‘q');

    const scope = await this.scopeWhere(user);
    const existing = await this.prisma.collection.findFirst({
      where: { AND: [{ id }, scope] },
      include: {
        months: true,
        case: { select: { number: true, createdById: true, borrower: { select: { fullName: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Undiruv topilmadi');

    const data: Prisma.CollectionUpdateInput = {};

    // Money: recompute the total from whichever of months/penya/shtraf changed.
    const nextMonths = dto.months ?? existing.months.map((m) => ({ year: m.year, month: m.month, amount: Number(m.amount) }));
    const penalty = dto.penalty ?? Number(existing.penalty);
    const fine = dto.fine ?? Number(existing.fine);
    if (dto.months || dto.penalty !== undefined || dto.fine !== undefined) {
      data.penalty = penalty;
      data.fine = fine;
      data.totalDebt = collectionTotal({ months: nextMonths, penalty, fine });
    }
    if (dto.months) {
      data.months = {
        deleteMany: {},
        create: dto.months.map((m) => ({ year: m.year, month: m.month, amount: m.amount, plannedAmount: m.amount })),
      };
    }
    if (dto.note !== undefined) data.note = dto.note;

    // Assignment change.
    let newlyAssigned = false;
    if (dto.assignedCollectorId !== undefined) {
      const collectorId = await this.resolveCollector(dto.assignedCollectorId);
      newlyAssigned = !!collectorId && collectorId !== existing.assignedCollectorId;
      data.assignedCollector = collectorId ? { connect: { id: collectorId } } : { disconnect: true };
      data.assignedBy = collectorId ? { connect: { id: user.id } } : { disconnect: true };
      data.assignedAt = collectorId ? new Date() : null;
      if (collectorId && existing.status === CollectionStatus.NEW) data.status = CollectionStatus.ASSIGNED;
    }

    // Explicit status change (e.g. closing) wins; closing stamps closedAt.
    if (dto.status) {
      data.status = dto.status;
      data.closedAt = dto.status === CollectionStatus.CLOSED ? new Date() : null;
    }

    const updated = await this.prisma.collection.update({ where: { id }, data, include: collectionDetailInclude });

    if (newlyAssigned) {
      await this.notify('assigned', {
        caseId: existing.caseId,
        caseNumber: existing.case.number,
        borrowerName: existing.case.borrower?.fullName ?? null,
        operatorId: existing.case.createdById,
        collectorId: updated.assignedCollectorId,
        actorId: user.id,
      });
    }
    return toCollectionDto(updated);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    if (!canDeleteCollection(user.role)) throw new ForbiddenException('Undiruvni o‘chirishga ruxsat yo‘q');
    const scope = await this.scopeWhere(user);
    const c = await this.prisma.collection.findFirst({ where: { AND: [{ id }, scope] }, select: { id: true, status: true } });
    if (!c) throw new NotFoundException('Undiruv topilmadi');
    if (c.status === CollectionStatus.CLOSED) throw new BadRequestException('Yopilgan undiruvni o‘chirib bo‘lmaydi');
    await this.prisma.collection.delete({ where: { id } });
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  /** A moderator may only manage collections on cases in their own branches. */
  private async assertCaseInScope(user: RequestUser, caseBranchId: string | null): Promise<void> {
    if (user.role !== Role.MODERATOR) return; // director/admin unrestricted; operator can't reach here
    const assigned = await this.prisma.branch.findMany({
      where: { moderators: { some: { id: user.id } } },
      select: { id: true },
    });
    if (!caseBranchId || !assigned.some((b) => b.id === caseBranchId)) {
      throw new ForbiddenException('Bu ariza sizning filial(lar)ingizga tegishli emas');
    }
  }

  /** Validate that an assigned id is an active collector; '' / null clears the assignment. */
  private async resolveCollector(assignedCollectorId?: string | null): Promise<string | null> {
    if (!assignedCollectorId) return null;
    const u = await this.prisma.user.findUnique({ where: { id: assignedCollectorId }, select: { role: true, isActive: true } });
    if (!u || u.role !== Role.COLLECTOR) throw new BadRequestException('Tanlangan undiruvchi topilmadi');
    if (!u.isActive) throw new BadRequestException('Undiruvchi bloklangan');
    return assignedCollectorId;
  }

  /** Best-effort notification write — never let it break the primary action. */
  private async notify(kind: CollectionEventKind, ctx: CollectionNotifyCtx): Promise<void> {
    const seeds: NotificationSeed[] = collectionNotifications(kind, ctx);
    if (!seeds.length) return;
    try {
      await this.prisma.notification.createMany({ data: seeds });
    } catch {
      /* notifications are advisory; a failure here must not fail the collection write */
    }
  }
}

function endOfDay(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
