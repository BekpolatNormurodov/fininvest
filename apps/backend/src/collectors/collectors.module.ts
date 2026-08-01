import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { CollectionStatus, Role, type CollectorListItem } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * Admin-managed undiruvchi (collector) accounts. A collector is a `User` with `role = COLLECTOR`
 * covering one or more branches (m-n, mirroring moderators). They sign in from the mobile app
 * (SP-3); here the admin only provisions and edits the account.
 */

class CreateCollectorDto {
  @IsString() @MinLength(1) fullName!: string;
  @IsString() @MinLength(3) login!: string;
  @IsString() @MinLength(4) password!: string;
  @IsOptional() @IsString() phone?: string;
  @IsArray() @IsString({ each: true }) branchIds!: string[];
}

class UpdateCollectorDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(4) password?: string;
}

const collectorInclude = {
  collectedBranches: { select: { id: true, name: true, symbol: true } },
  assignedCollections: { where: { status: { not: CollectionStatus.CLOSED } }, select: { id: true } },
};

type CollectorRow = {
  id: string;
  fullName: string;
  login: string;
  plainPassword: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  collectedBranches: { id: string; name: string; symbol: string }[];
  assignedCollections: { id: string }[];
};

function toCollector(u: CollectorRow): CollectorListItem {
  return {
    id: u.id,
    fullName: u.fullName,
    login: u.login,
    plainPassword: u.plainPassword,
    phone: u.phone,
    isActive: u.isActive,
    branches: u.collectedBranches,
    activeCount: u.assignedCollections.length,
    createdAt: u.createdAt.toISOString(),
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('collectors')
class CollectorsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<CollectorListItem[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: Role.COLLECTOR },
      include: collectorInclude,
      orderBy: { fullName: 'asc' },
    });
    return rows.map((r) => toCollector(r as CollectorRow));
  }

  @Post()
  async create(@Body() dto: CreateCollectorDto): Promise<CollectorListItem> {
    await this.assertLoginFree(dto.login);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        login: dto.login,
        role: Role.COLLECTOR,
        phone: dto.phone ?? null,
        passwordHash,
        plainPassword: dto.password,
        collectedBranches: dto.branchIds.length ? { connect: dto.branchIds.map((id) => ({ id })) } : undefined,
      },
      include: collectorInclude,
    });
    return toCollector(created as CollectorRow);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCollectorDto): Promise<CollectorListItem> {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target || target.role !== Role.COLLECTOR) throw new NotFoundException('Undiruvchi topilmadi');

    const data: Record<string, unknown> = {
      fullName: dto.fullName,
      phone: dto.phone,
      isActive: dto.isActive,
    };
    if (dto.branchIds !== undefined) data.collectedBranches = { set: dto.branchIds.map((bid) => ({ id: bid })) };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      data.plainPassword = dto.password;
    }
    const updated = await this.prisma.user.update({ where: { id }, data, include: collectorInclude });
    return toCollector(updated as CollectorRow);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target || target.role !== Role.COLLECTOR) throw new NotFoundException('Undiruvchi topilmadi');
    // Soft-disable rather than hard-delete — assigned collections keep their history.
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  private async assertLoginFree(login: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { login }, select: { id: true } });
    if (existing) throw new BadRequestException('Bu login band');
  }
}

@Module({ controllers: [CollectorsController] })
export class CollectorsModule {}
