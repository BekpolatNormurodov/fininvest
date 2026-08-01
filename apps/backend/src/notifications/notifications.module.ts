import { Controller, Get, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { NotificationDto } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

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
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
