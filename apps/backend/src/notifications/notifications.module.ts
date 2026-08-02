import { Body, Controller, Delete, Get, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { NotificationDto } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

class DeviceTokenDto {
  @IsString() @MinLength(8) token!: string;
  @IsOptional() @IsString() platform?: string;
}

/**
 * Per-user notifications. SP-1 writes them from the collection domain (created / assigned); this
 * controller is the read side — the web bell and, later, the mobile app poll it.
 */
@UseGuards(JwtAuthGuard)
@Controller('notifications')
class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('unread') unread?: string): Promise<NotificationDto[]> {
    const onlyUnread = unread === '1' || unread === 'true';
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id, ...(onlyUnread ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      caseId: n.caseId,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId: user.id, read: false } });
    return { count };
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<{ ok: true }> {
    // Scoped to the caller so one user can't flip another's notification.
    await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
    return { ok: true };
  }

  @Post('read-all')
  async markAll(@CurrentUser() user: RequestUser): Promise<{ ok: true }> {
    await this.prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    return { ok: true };
  }

  // ── FCM device tokens (SP-4 groundwork) ─────────────────────────────────────
  // The mobile app registers its push token here after login. Sending pushes needs firebase-admin +
  // a service account (see the mobile README); until then tokens are simply collected.
  @Post('device-token')
  async registerToken(@CurrentUser() user: RequestUser, @Body() dto: DeviceTokenDto): Promise<{ ok: true }> {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { token: dto.token, platform: dto.platform ?? null, userId: user.id },
      update: { userId: user.id, platform: dto.platform ?? null },
    });
    return { ok: true };
  }

  @Delete('device-token/:token')
  async unregisterToken(@CurrentUser() user: RequestUser, @Param('token') token: string): Promise<{ ok: true }> {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId: user.id } });
    return { ok: true };
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
