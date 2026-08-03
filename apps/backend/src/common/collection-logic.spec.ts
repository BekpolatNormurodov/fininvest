import {
  collectionTotal,
  collectionRemaining,
  collectionCollectedPct,
  collectionStats,
  matchesCollectionFilter,
  activeCollectionFilterCount,
  EMPTY_COLLECTION_FILTER,
  CollectionStatus,
  type CollectionListItem,
  type CollectionFilter,
} from '@credit-core/shared';

/*
  The undiruv (collection) pure logic, exercised as the same functions the server, web and mobile
  all share. Money is entered by hand (no core-banking feed), so these are the single source of the
  totals, the remaining balance and the sidebar statistics.
*/

describe('collectionTotal — Σ months + penya + shtraf', () => {
  it('sums months and adds penalty and fine', () => {
    expect(collectionTotal({ months: [{ amount: 1_000_000 }, { amount: 500_000 }], penalty: 120_000, fine: 80_000 }))
      .toBe(1_700_000);
  });
  it('is zero for an empty, no-penalty collection', () => {
    expect(collectionTotal({ months: [], penalty: 0, fine: 0 })).toBe(0);
  });
  it('floors a negative total at zero', () => {
    expect(collectionTotal({ months: [{ amount: -5 }], penalty: 0, fine: 0 })).toBe(0);
  });
  it('handles fractional som', () => {
    expect(collectionTotal({ months: [{ amount: 1_234.56 }], penalty: 0.44, fine: 0 })).toBeCloseTo(1_235, 5);
  });
});

describe('collectionRemaining and collectedPct', () => {
  it('remaining is total minus collected, never below zero', () => {
    expect(collectionRemaining(1_000_000, 300_000)).toBe(700_000);
    expect(collectionRemaining(1_000_000, 1_000_000)).toBe(0);
    expect(collectionRemaining(1_000_000, 1_500_000)).toBe(0); // overpaid — floored
  });
  it('percent is 0..100, rounded, and 0 when there is no debt', () => {
    expect(collectionCollectedPct(1_000_000, 250_000)).toBe(25);
    expect(collectionCollectedPct(0, 0)).toBe(0);
    expect(collectionCollectedPct(1_000_000, 2_000_000)).toBe(100); // capped
  });
});

const row = (o: Partial<CollectionListItem>): CollectionListItem => ({
  id: 'x', caseId: 'c', caseNumber: 'BR-1', contractNumber: null, borrowerName: 'X',
  branchName: 'Buxoro filiali', region: 'Buxoro', status: CollectionStatus.ASSIGNED,
  totalDebt: 1_000_000, collectedAmount: 0, penalty: 0, fine: 0, monthsCount: 1,
  collectorId: 'u1', collectorName: 'Ali', createdByName: 'Vali',
  assignedAt: '2026-07-01T00:00:00.000Z', dueDays: 4, deadlineAt: '2026-07-05T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z', ...o,
});

describe('collectionStats — the sidebar rollup', () => {
  it('totals debt, collected, remaining and percent across rows', () => {
    const s = collectionStats([
      row({ totalDebt: 1_000_000, collectedAmount: 250_000 }),
      row({ totalDebt: 3_000_000, collectedAmount: 750_000 }),
    ]);
    expect(s.count).toBe(2);
    expect(s.totalDebt).toBe(4_000_000);
    expect(s.totalCollected).toBe(1_000_000);
    expect(s.remaining).toBe(3_000_000);
    expect(s.collectedPct).toBe(25);
  });

  it('counts active (not CLOSED) vs closed', () => {
    const s = collectionStats([
      row({ status: CollectionStatus.NEW }),
      row({ status: CollectionStatus.ASSIGNED }),
      row({ status: CollectionStatus.CLOSED }),
    ]);
    expect(s.activeCount).toBe(2);
    expect(s.closedCount).toBe(1);
  });

  it('breaks down by collector, folding the unassigned into one slice', () => {
    const s = collectionStats([
      row({ collectorId: 'u1', collectorName: 'Ali', totalDebt: 1_000_000 }),
      row({ collectorId: 'u1', collectorName: 'Ali', totalDebt: 2_000_000 }),
      row({ collectorId: null, collectorName: null, totalDebt: 500_000 }),
    ]);
    const ali = s.byCollector.find((x) => x.label === 'Ali');
    const none = s.byCollector.find((x) => x.label === 'Biriktirilmagan');
    expect(ali?.count).toBe(2);
    expect(ali?.totalDebt).toBe(3_000_000);
    expect(none?.count).toBe(1);
    // slices are ordered by debt, largest first
    expect(s.byCollector[0].label).toBe('Ali');
  });

  it('breaks down by branch', () => {
    const s = collectionStats([
      row({ branchName: 'Buxoro filiali', totalDebt: 1_000_000 }),
      row({ branchName: 'Markaziy filial', totalDebt: 4_000_000 }),
    ]);
    expect(s.byBranch[0].label).toBe('Markaziy filial'); // biggest debt leads
    expect(s.byBranch).toHaveLength(2);
  });

  it('an empty list is all zeros, no slices', () => {
    const s = collectionStats([]);
    expect(s).toMatchObject({ count: 0, totalDebt: 0, totalCollected: 0, remaining: 0, collectedPct: 0 });
    expect(s.byStatus).toHaveLength(0);
  });
});

describe('matchesCollectionFilter — AND across dimensions, OR within', () => {
  const filter = (o: Partial<CollectionFilter>): CollectionFilter => ({ ...EMPTY_COLLECTION_FILTER, ...o });

  it('the empty filter matches everything and counts as zero', () => {
    expect(matchesCollectionFilter(EMPTY_COLLECTION_FILTER, row({}))).toBe(true);
    expect(activeCollectionFilterCount(EMPTY_COLLECTION_FILTER)).toBe(0);
  });

  it('filters by status', () => {
    const f = filter({ statuses: new Set([CollectionStatus.CLOSED]) });
    expect(matchesCollectionFilter(f, row({ status: CollectionStatus.CLOSED }))).toBe(true);
    expect(matchesCollectionFilter(f, row({ status: CollectionStatus.NEW }))).toBe(false);
  });

  it('filters by collector, dropping unassigned when a collector is chosen', () => {
    const f = filter({ collectorIds: new Set(['u1']) });
    expect(matchesCollectionFilter(f, row({ collectorId: 'u1' }))).toBe(true);
    expect(matchesCollectionFilter(f, row({ collectorId: 'u2' }))).toBe(false);
    expect(matchesCollectionFilter(f, row({ collectorId: null }))).toBe(false);
  });

  it('filters by branch and by created-at day range inclusive of both ends', () => {
    const f = filter({ branches: new Set(['Buxoro filiali']), from: '2026-07-01T00:00:00.000Z', to: '2026-07-31T00:00:00.000Z' });
    expect(matchesCollectionFilter(f, row({ createdAt: '2026-07-31T22:00:00.000Z' }))).toBe(true);
    expect(matchesCollectionFilter(f, row({ createdAt: '2026-08-01T00:05:00.000Z' }))).toBe(false);
    expect(matchesCollectionFilter(f, row({ branchName: 'Markaziy filial' }))).toBe(false);
  });

  it('combines dimensions with AND', () => {
    const f = filter({ statuses: new Set([CollectionStatus.ASSIGNED]), collectorIds: new Set(['u1']) });
    expect(matchesCollectionFilter(f, row({ status: CollectionStatus.ASSIGNED, collectorId: 'u1' }))).toBe(true);
    expect(matchesCollectionFilter(f, row({ status: CollectionStatus.CLOSED, collectorId: 'u1' }))).toBe(false);
    expect(activeCollectionFilterCount(f)).toBe(2);
  });
});
