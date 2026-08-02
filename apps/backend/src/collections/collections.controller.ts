import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CollectionStatus, Role } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from '../documents/storage.service';
import { decodeUploadName } from '../common/upload-name.util';
import { CollectionsService, type CollectionListFilters } from './collections.service';
import { CreateCollectionDto, CreateVisitDto, UpdateCollectionDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly service: CollectionsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: CollectionStatus,
    @Query('collectorId') collectorId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list(user, filters(status, collectorId, branchId, from, to));
  }

  @Get('stats')
  stats(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: CollectionStatus,
    @Query('collectorId') collectorId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.stats(user, filters(status, collectorId, branchId, from, to));
  }

  @Get('by-case/:caseId')
  forCase(@CurrentUser() user: RequestUser, @Param('caseId') caseId: string) {
    return this.service.forCase(user, caseId);
  }

  // Field visit media (bearer-authenticated) — streamed to the collector / manager.
  @Get('visits/media/:mediaId')
  async media(@CurrentUser() user: RequestUser, @Param('mediaId') mediaId: string, @Res() res: Response) {
    const { path } = await this.service.resolveMedia(user, mediaId);
    const ext = path.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'mp4' ? 'video/mp4'
      : ext === 'mov' ? 'video/quicktime'
      : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    this.storage.stream(path).pipe(res);
  }

  // A collector logs a field visit (multipart: media files + fields).
  @UseInterceptors(FilesInterceptor('media', 8))
  @Post(':id/visits')
  createVisit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateVisitDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const media = (files ?? []).map((f) => ({
      buffer: f.buffer,
      originalName: decodeUploadName(f.originalname),
      mimeType: f.mimetype,
    }));
    return this.service.createVisit(user, id, dto, media);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.get(user, id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DIRECTOR, Role.MODERATOR)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCollectionDto) {
    return this.service.create(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DIRECTOR, Role.MODERATOR)
  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.service.update(user, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.service.remove(user, id);
    return { ok: true };
  }
}

function filters(
  status?: CollectionStatus,
  collectorId?: string,
  branchId?: string,
  from?: string,
  to?: string,
): CollectionListFilters {
  return { status, collectorId, branchId, from, to };
}
