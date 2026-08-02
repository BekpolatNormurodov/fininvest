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
import { randomInt } from 'crypto';
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
  // The phone IS the unique login. Password is optional — empty means the server generates one.
  @IsString() @MinLength(7) phone!: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsArray() @IsString({ each: true }) branchIds!: string[];
}

class UpdateCollectorDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() @MinLength(7) phone?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(6) password?: string;
}

/** Phone → canonical login: digits only (so formatting differences never split one collector in two). */
export function phoneToLogin(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** A readable 6-character password (no ambiguous chars) — used when the admin leaves it blank. */
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
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
    const login = phoneToLogin(dto.phone);
    if (login.length < 7) throw new BadRequestException('Telefon raqami noto‘g‘ri');
    await this.assertLoginFree(login);
    // Empty password → the system generates a readable one; the admin sees it in the list.
    const password = dto.password && dto.password.length >= 6 ? dto.password : generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        login,
        role: Role.COLLECTOR,
        phone: dto.phone,
        passwordHash,
        plainPassword: password,
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
    if (dto.phone !== undefined) {
      const login = phoneToLogin(dto.phone);
      if (login.length < 7) throw new BadRequestException('Telefon raqami noto‘g‘ri');
      await this.assertLoginFree(login, id);
      data.login = login;
    }
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

  private async assertLoginFree(login: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { login }, select: { id: true } });
    if (existing && existing.id !== exceptId) throw new BadRequestException('Bu telefon raqami band');
  }
}

@Module({ controllers: [CollectorsController] })
export class CollectorsModule {}
