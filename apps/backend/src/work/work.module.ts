import { Body, Controller, ForbiddenException, Get, Module, Post, Query, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Role, workSessionDuration, type LiveLocationDto, type WorkSessionDto } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

class StartDto {
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
}
class PingDto {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
}

const sessionInclude = {
  collector: { select: { fullName: true } },
  _count: { select: { pings: true } },
};

function toSession(s: {
  id: string; collectorId: string; startedAt: Date; endedAt: Date | null;
  startLat: number | null; startLng: number | null; endLat: number | null; endLng: number | null;
  collector: { fullName: string } | null; _count: { pings: number };
}): WorkSessionDto {
  const startedAt = s.startedAt.toISOString();
  const endedAt = s.endedAt?.toISOString() ?? null;
  return {
    id: s.id,
    collectorId: s.collectorId,
    collectorName: s.collector?.fullName ?? null,
    startedAt,
    endedAt,
    startLat: s.startLat,
    startLng: s.startLng,
    endLat: s.endLat,
    endLng: s.endLng,
    pingCount: s._count.pings,
    durationMin: workSessionDuration(startedAt, endedAt),
  };
}

@UseGuards(JwtAuthGuard)
@Controller('work')
class WorkController {
  constructor(private readonly prisma: PrismaService) {}

  private assertCollector(user: RequestUser) {
    if (user.role !== Role.COLLECTOR) throw new ForbiddenException('Faqat undiruvchi uchun');
  }

  /** Start a shift — idempotent: if one is already open it is returned. */
  @Post('start')
  async start(@CurrentUser() user: RequestUser, @Body() dto: StartDto): Promise<WorkSessionDto> {
    this.assertCollector(user);
    const open = await this.prisma.workSession.findFirst({
      where: { collectorId: user.id, endedAt: null },
      include: sessionInclude,
    });
    if (open) return toSession(open);
    const created = await this.prisma.workSession.create({
      data: { collectorId: user.id, startLat: dto.lat ?? null, startLng: dto.lng ?? null },
      include: sessionInclude,
    });
    return toSession(created);
  }

  /** End the open shift. */
  @Post('end')
  async end(@CurrentUser() user: RequestUser, @Body() dto: StartDto): Promise<WorkSessionDto | null> {
    this.assertCollector(user);
    const open = await this.prisma.workSession.findFirst({ where: { collectorId: user.id, endedAt: null } });
    if (!open) return null;
    const updated = await this.prisma.workSession.update({
      where: { id: open.id },
      data: { endedAt: new Date(), endLat: dto.lat ?? null, endLng: dto.lng ?? null },
      include: sessionInclude,
    });
    return toSession(updated);
  }

  /** Record a location sample against the open shift (no-op when off-shift). */
  @Post('ping')
  async ping(@CurrentUser() user: RequestUser, @Body() dto: PingDto): Promise<{ ok: boolean }> {
    this.assertCollector(user);
    const open = await this.prisma.workSession.findFirst({ where: { collectorId: user.id, endedAt: null }, select: { id: true } });
    if (!open) return { ok: false };
    await this.prisma.locationPing.create({ data: { sessionId: open.id, lat: dto.lat, lng: dto.lng } });
    return { ok: true };
  }

  /** Latest position of every on-shift collector — the admin/director live map polls this. */
  @Get('live')
  async live(@CurrentUser() user: RequestUser): Promise<LiveLocationDto[]> {
    if (user.role !== Role.ADMIN && user.role !== Role.DIRECTOR && user.role !== Role.MODERATOR) return [];
    const sessions = await this.prisma.workSession.findMany({
      where: { endedAt: null },
      include: { collector: { select: { fullName: true } }, pings: { orderBy: { at: 'desc' }, take: 1 } },
    });
    const out: LiveLocationDto[] = [];
    for (const s of sessions) {
      const p = s.pings[0];
      const lat = p?.lat ?? s.startLat;
      const lng = p?.lng ?? s.startLng;
      if (lat == null || lng == null) continue;
      out.push({
        collectorId: s.collectorId,
        name: s.collector?.fullName ?? '',
        lat,
        lng,
        at: (p?.at ?? s.startedAt).toISOString(),
        since: s.startedAt.toISOString(),
      });
    }
    return out;
  }

  @Get('current')
  async current(@CurrentUser() user: RequestUser): Promise<WorkSessionDto | null> {
    const open = await this.prisma.workSession.findFirst({
      where: { collectorId: user.id, endedAt: null },
      include: sessionInclude,
    });
    return open ? toSession(open) : null;
  }

  /** Shift history — a collector sees their own; managers see any (optionally one collector). */
  @Get('sessions')
  async sessions(
    @CurrentUser() user: RequestUser,
    @Query('collectorId') collectorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<WorkSessionDto[]> {
    const where: { collectorId?: string; startedAt?: { gte?: Date; lte?: Date } } = {};
    if (user.role === Role.COLLECTOR) where.collectorId = user.id;
    else if (collectorId) where.collectorId = collectorId;
    if (from || to) where.startedAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };

    const rows = await this.prisma.workSession.findMany({
      where,
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
    return rows.map(toSession);
  }
}

@Module({ controllers: [WorkController] })
export class WorkModule {}
