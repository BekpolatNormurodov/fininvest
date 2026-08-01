import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CollectionStatus, Role } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { CollectionsService, type CollectionListFilters } from './collections.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('collections')
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

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
