import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CaseStatus, DEADLINE_STEPS, ProductType, Role, StatsResponse } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { toListItem, listItemInclude } from '../credit-cases/case.mapper';

async function scopeFor(prisma: PrismaService, user: RequestUser): Promise<Prisma.CreditCaseWhereInput> {
  if (user.role === Role.OPERATOR) return { createdById: user.id };
  if (user.role === Role.MODERATOR) {
    const assigned = await prisma.branch.findMany({ where: { moderators: { some: { id: user.id } } }, select: { id: true } });
    return { branchId: { in: assigned.map((b) => b.id) } };
  }
  return {};
}

@UseGuards(JwtAuthGuard)
@Controller('stats')
class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('region') region?: string,
  ): Promise<StatsResponse> {
    const where = await scopeFor(this.prisma, user);
    where.deletedAt = null; // archived (soft-deleted) cases are excluded from all metrics
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    // Branch / region filter — general roles (admin/director) can drill in.
    const canDrill = user.role === Role.ADMIN || user.role === Role.DIRECTOR;
    if (canDrill && branchId) {
      where.branchId = branchId;
    } else if (canDrill && region) {
      where.branch = { region };
    }

    const now = new Date();
    const [byStatusRaw, all, branches, collaterals, pausedCount, overdueCount] = await Promise.all([
      this.prisma.creditCase.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.creditCase.findMany({
        where,
        select: { amount: true, katmPrice: true, status: true, branchId: true, productType: true, createdAt: true },
      }),
      this.prisma.branch.findMany({ select: { id: true, symbol: true } }),
      this.prisma.collateral.findMany({ where: { case: where }, select: { agreedValue: true } }),
      this.prisma.creditCase.count({ where: { ...where, pausedAt: { not: null } } }),
      this.prisma.creditCase.count({
        where: { ...where, status: { in: DEADLINE_STEPS }, pausedAt: null, stepDeadlineAt: { not: null, lt: now } },
      }),
    ]);

    const byStatus = (Object.values(CaseStatus) as CaseStatus[]).map((status) => ({
      status,
      count: byStatusRaw.find((b) => b.status === status)?._count._all ?? 0,
    }));

    const branchMap = new Map(branches.map((b) => [b.id, b.symbol]));
    const branchAgg = new Map<string, { count: number; amount: number }>();
    const productAgg = new Map<ProductType, { count: number; amount: number }>();
    const monthAgg = new Map<string, { count: number; amount: number }>();
    const productMonthAgg = new Map<string, { realEstate: number; auto: number }>();
    let totalAmount = 0;
    let totalKatm = 0;
    for (const c of all) {
      const amt = c.amount ? Number(c.amount) : 0;
      totalAmount += amt;
      totalKatm += c.katmPrice ? Number(c.katmPrice) : 0;
      const key = c.branchId ? branchMap.get(c.branchId) ?? '—' : '—';
      const ba = branchAgg.get(key) ?? { count: 0, amount: 0 };
      branchAgg.set(key, { count: ba.count + 1, amount: ba.amount + amt });
      const p = c.productType as ProductType;
      const pa = productAgg.get(p) ?? { count: 0, amount: 0 };
      productAgg.set(p, { count: pa.count + 1, amount: pa.amount + amt });
      const mk = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const ma = monthAgg.get(mk) ?? { count: 0, amount: 0 };
      monthAgg.set(mk, { count: ma.count + 1, amount: ma.amount + amt });
      const pm = productMonthAgg.get(mk) ?? { realEstate: 0, auto: 0 };
      if (p === ProductType.AUTO) pm.auto += 1;
      else pm.realEstate += 1;
      productMonthAgg.set(mk, pm);
    }

    // Last 6 calendar months (oldest → newest), zero-filled.
    const monthKeys = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const byMonth = monthKeys.map((mk) => {
      const v = monthAgg.get(mk) ?? { count: 0, amount: 0 };
      return { month: mk, count: v.count, amount: v.amount };
    });
    const byProductMonth = monthKeys.map((mk) => {
      const v = productMonthAgg.get(mk) ?? { realEstate: 0, auto: 0 };
      return { month: mk, realEstate: v.realEstate, auto: v.auto };
    });

    const totalCollateralValue = collaterals.reduce((s, c) => s + (c.agreedValue ? Number(c.agreedValue) : 0), 0);
    const finalizedCount = byStatus.find((s) => s.status === CaseStatus.FINALIZED)?.count ?? 0;
    const activeCount = all.length - finalizedCount - (byStatus.find((s) => s.status === CaseStatus.REJECTED)?.count ?? 0);

    const recentRaw = await this.prisma.creditCase.findMany({
      where,
      include: listItemInclude,
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return {
      byStatus,
      byBranch: [...branchAgg.entries()]
        .map(([branch, v]) => ({ branch, count: v.count, amount: v.amount }))
        .sort((a, b) => b.count - a.count),
      byProduct: (Object.values(ProductType) as ProductType[]).map((product) => ({
        product,
        count: productAgg.get(product)?.count ?? 0,
        amount: productAgg.get(product)?.amount ?? 0,
      })),
      byMonth,
      byProductMonth,
      totalCases: all.length,
      totalAmount,
      totalKatm,
      totalCollateralValue,
      avgAmount: all.length ? Math.round(totalAmount / all.length) : 0,
      approvalRate: all.length ? finalizedCount / all.length : 0,
      finalizedCount,
      activeCount,
      overdueCount,
      pausedCount,
      // One mapper for the whole app — this list drifted from CreditCaseListItem when it was hand-built.
      recent: recentRaw.map(toListItem),
    };
  }
}

@Module({ controllers: [StatsController] })
export class StatsModule {}
