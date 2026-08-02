import { Prisma } from '@prisma/client';
import type { CollectionDto, CollectionListItem, CollectionMonthDto, VisitDto } from '@credit-core/shared';

/** Turns a Decimal | number | null into a plain number (0 when absent). */
const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

// ── list rows ─────────────────────────────────────────────────────────────────

export const collectionListInclude = {
  case: {
    select: {
      number: true,
      contractNumber: true,
      borrower: { select: { fullName: true } },
      branch: { select: { name: true, region: true } },
    },
  },
  assignedCollector: { select: { id: true, fullName: true } },
  createdBy: { select: { fullName: true } },
  _count: { select: { months: true } },
} satisfies Prisma.CollectionInclude;

type CollectionListRow = Prisma.CollectionGetPayload<{ include: typeof collectionListInclude }>;

export function toCollectionListItem(c: CollectionListRow): CollectionListItem {
  return {
    id: c.id,
    caseId: c.caseId,
    caseNumber: c.case.number,
    contractNumber: c.case.contractNumber,
    borrowerName: c.case.borrower?.fullName ?? null,
    branchName: c.case.branch?.name ?? null,
    region: c.case.branch?.region ?? null,
    status: c.status,
    totalDebt: num(c.totalDebt),
    collectedAmount: num(c.collectedAmount),
    penalty: num(c.penalty),
    fine: num(c.fine),
    monthsCount: c._count.months,
    collectorId: c.assignedCollector?.id ?? null,
    collectorName: c.assignedCollector?.fullName ?? null,
    createdByName: c.createdBy?.fullName ?? null,
    assignedAt: c.assignedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// ── full detail ───────────────────────────────────────────────────────────────

export const collectionDetailInclude = {
  months: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
  visits: {
    orderBy: { createdAt: 'desc' },
    include: { collector: { select: { fullName: true } }, media: { select: { id: true, kind: true } } },
  },
  case: {
    select: {
      number: true,
      contractNumber: true,
      borrower: { select: { fullName: true } },
      branch: { select: { name: true, region: true } },
    },
  },
  assignedCollector: { select: { id: true, fullName: true } },
  assignedBy: { select: { fullName: true } },
  createdBy: { select: { fullName: true } },
} satisfies Prisma.CollectionInclude;

type CollectionDetailRow = Prisma.CollectionGetPayload<{ include: typeof collectionDetailInclude }>;

export function toCollectionDto(c: CollectionDetailRow): CollectionDto {
  const months: CollectionMonthDto[] = c.months.map((m) => ({
    id: m.id,
    year: m.year,
    month: m.month,
    plannedAmount: num(m.plannedAmount),
    amount: num(m.amount),
  }));
  return {
    id: c.id,
    caseId: c.caseId,
    caseNumber: c.case.number,
    contractNumber: c.case.contractNumber,
    borrowerName: c.case.borrower?.fullName ?? null,
    branchName: c.case.branch?.name ?? null,
    region: c.case.branch?.region ?? null,
    status: c.status,
    months,
    penalty: num(c.penalty),
    fine: num(c.fine),
    totalDebt: num(c.totalDebt),
    collectedAmount: num(c.collectedAmount),
    note: c.note,
    visits: c.visits.map(
      (v): VisitDto => ({
        id: v.id,
        collectorName: v.collector?.fullName ?? null,
        lat: v.lat,
        lng: v.lng,
        amount: num(v.amount),
        letterType: v.letterType,
        comment: v.comment,
        media: v.media.map((m) => ({ id: m.id, kind: m.kind === 'video' ? 'video' : 'image' })),
        createdAt: v.createdAt.toISOString(),
      }),
    ),
    collector: c.assignedCollector ? { id: c.assignedCollector.id, fullName: c.assignedCollector.fullName } : null,
    assignedByName: c.assignedBy?.fullName ?? null,
    assignedAt: c.assignedAt?.toISOString() ?? null,
    createdByName: c.createdBy?.fullName ?? null,
    closedAt: c.closedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
