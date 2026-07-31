import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Post,
  Put,
  Param,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from '../documents/storage.service';
import { decodeUploadName } from '../common/upload-name.util';

class CreateUserDto {
  @IsString() @MinLength(1) fullName!: string;
  @IsString() @MinLength(3) login!: string;
  @IsString() @MinLength(4) password!: string;
  @IsEnum(Role) role!: Role;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() branchId?: string; // operator: single branch
  @IsOptional() @IsArray() @IsString({ each: true }) moderatedBranchIds?: string[]; // moderator: many
}

class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) moderatedBranchIds?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(4) password?: string;
}

// Admin-only controller, so returning the plaintext credential here is intentional
// (internal credential-distribution tool). Never expose this select to other roles.
const userSelect = {
  id: true,
  fullName: true,
  login: true,
  phone: true,
  plainPassword: true,
  avatarPath: true,
  role: true,
  branchId: true,
  isActive: true,
  branch: { select: { id: true, name: true, symbol: true } },
  moderatedBranches: { select: { id: true, name: true } },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
  ) {}

  @Get()
  list() {
    return this.prisma.user.findMany({ select: userSelect, orderBy: { fullName: 'asc' } });
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const isModerator = dto.role === Role.MODERATOR;
    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        login: dto.login,
        role: dto.role,
        phone: dto.phone ?? null,
        // Operator → one personal branch; moderator → many moderatedBranches; director/admin → none.
        branchId: isModerator ? null : dto.branchId ?? null,
        moderatedBranches: isModerator && dto.moderatedBranchIds?.length
          ? { connect: dto.moderatedBranchIds.map((id) => ({ id })) }
          : undefined,
        passwordHash,
        plainPassword: dto.password,
      },
      select: userSelect,
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: RequestUser) {
    // Lockout guards: don't let an admin block themselves or the last active admin.
    const deactivating = dto.isActive === false;
    const demoting = dto.role !== undefined && dto.role !== Role.ADMIN;
    if (deactivating || demoting) {
      const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
      if (!target) throw new NotFoundException('Foydalanuvchi topilmadi');
      if (deactivating && id === actor.id) throw new BadRequestException('O‘zingizni bloklay olmaysiz');
      if (target.role === Role.ADMIN && (deactivating || demoting)) {
        const activeAdmins = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
        if (activeAdmins <= 1) throw new BadRequestException('Oxirgi faol adminni bloklab yoki rolini o‘zgartirib bo‘lmaydi');
      }
    }

    const data: Record<string, unknown> = {
      fullName: dto.fullName,
      role: dto.role,
      isActive: dto.isActive,
      phone: dto.phone,
    };
    if (dto.role === Role.MODERATOR) {
      data.branchId = null; // moderator has no personal branch
      if (dto.moderatedBranchIds !== undefined) data.moderatedBranches = { set: dto.moderatedBranchIds.map((id) => ({ id })) };
    } else {
      data.branchId = dto.branchId === undefined ? undefined : dto.branchId || null;
      if (dto.role !== undefined) data.moderatedBranches = { set: [] }; // leaving moderator → drop branches
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      data.plainPassword = dto.password;
    }
    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Rasm yuborilmadi');
    const stored = await this.storage.save(file.buffer, decodeUploadName(file.originalname), file.mimetype, `avatars/${id}`);
    return this.prisma.user.update({ where: { id }, data: { avatarPath: stored.storagePath }, select: userSelect });
  }
}

/**
 * Avatar serving — separate controller with NO class-level guards so an
 * <img src="...?token="> request (which can't send an Authorization header)
 * is authenticated by the query token instead of being blocked by JwtAuthGuard.
 */
@Controller('users')
class UserAvatarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
  ) {}

  @Get(':id/avatar')
  async getAvatar(@Param('id') id: string, @Res() res: Response, @Query('token') token?: string) {
    const header = (res.req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const raw = header || token;
    if (!raw) throw new UnauthorizedException();
    try { this.jwt.verify(raw); } catch { throw new UnauthorizedException(); }
    const user = await this.prisma.user.findUnique({ where: { id }, select: { avatarPath: true } });
    if (!user?.avatarPath) throw new NotFoundException('Avatar yo‘q');
    const ext = user.avatarPath.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    this.storage.stream(user.avatarPath).pipe(res);
  }
}

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') ?? 'dev-secret' }),
    }),
  ],
  controllers: [UserAvatarController, UsersController],
})
export class UsersModule {}
