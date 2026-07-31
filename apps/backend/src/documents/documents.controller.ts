import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { DocumentType, Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from './storage.service';
import { decodeUploadName } from '../common/upload-name.util';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('caseId') caseId: string,
    @Query('type') type: DocumentType,
    @CurrentUser() user: RequestUser,
    @Query('collateralId') collateralId?: string,
    @Body('title') title?: string,
    @Body('description') description?: string,
  ) {
    if (!file) throw new BadRequestException('Fayl yuborilmadi');
    if (!caseId) throw new BadRequestException('caseId kerak');
    const docType = (Object.values(DocumentType) as string[]).includes(type) ? type : DocumentType.OTHER;
    const stored = await this.storage.save(file.buffer, decodeUploadName(file.originalname), file.mimetype, caseId);
    return this.prisma.document.create({
      data: {
        caseId,
        collateralId: collateralId || null,
        title: title || null,
        description: description || null,
        type: docType as DocumentType,
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        uploadedById: user.id,
      },
    });
  }

  /** Replace a document's file in place (keeps id/type/collateral/title). Uploader or admin. */
  @UseGuards(JwtAuthGuard)
  @Put(':id/file')
  @UseInterceptors(FileInterceptor('file'))
  async replace(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) throw new BadRequestException('Fayl yuborilmadi');
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (doc.uploadedById !== user.id && user.role !== Role.ADMIN) throw new ForbiddenException('Bu hujjatni o‘zgartira olmaysiz');
    const stored = await this.storage.save(file.buffer, decodeUploadName(file.originalname), file.mimetype, doc.caseId ?? undefined);
    await this.storage.remove(doc.storagePath);
    return this.prisma.document.update({
      where: { id },
      data: { fileName: stored.fileName, storagePath: stored.storagePath, mimeType: stored.mimeType, uploadedById: user.id },
    });
  }

  /** Delete a document. Uploader or admin. */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (doc.uploadedById !== user.id && user.role !== Role.ADMIN) throw new ForbiddenException('Bu hujjatni o‘chira olmaysiz');
    await this.prisma.document.delete({ where: { id } });
    await this.storage.remove(doc.storagePath);
    return { ok: true };
  }

  /**
   * Download/view. Accepts the JWT via Authorization header OR `?token=` query
   * param so it can be opened directly in a new browser tab for inline viewing.
   * `?inline=1` renders the file in the browser instead of forcing a download.
   */
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('token') token: string | undefined,
    @Query('inline') inline: string | undefined,
  ) {
    // Auth: header or query token.
    const header = (res.req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const raw = header || token;
    if (!raw) throw new UnauthorizedException();
    try {
      this.jwt.verify(raw);
    } catch {
      throw new UnauthorizedException();
    }

    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    res.setHeader('Content-Type', doc.mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(doc.fileName)}"`,
    );
    this.storage.stream(doc.storagePath).pipe(res);
  }
}
