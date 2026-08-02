import { CollectionStatus, LetterType, Role } from './enums';

/**
 * Undiruv (debt-collection) domain — shared shapes and browser-free logic.
 *
 * There is no external core-banking feed, so arrears are entered by hand: a collection carries a set
 * of unpaid months plus penya/shtraf. The total, the remaining balance and the list statistics are
 * pure functions here (tested from the backend jest suite) so the same numbers hold on the server,
 * the web and — later — the mobile app.
 */

// ── request/response DTOs ─────────────────────────────────────────────────────

/** One unpaid month, as entered on the form. `planned` is the schedule's default; `amount` the arrears. */
export interface CollectionMonthInput {
  year: number;
  month: number; // 1..12
  amount: number;
}

export interface CollectionMonthDto extends CollectionMonthInput {
  id: string;
  plannedAmount: number;
}

export interface CollectorRef {
  id: string;
  fullName: string;
}

export interface VisitMediaDto {
  id: string;
  kind: 'image' | 'video';
}

/** A logged field visit (SP-2). */
export interface VisitDto {
  id: string;
  collectorName: string | null;
  lat: number | null;
  lng: number | null;
  amount: number;
  letterType: LetterType;
  comment: string | null;
  media: VisitMediaDto[];
  createdAt: string;
}

export interface CreateVisitInput {
  amount: number;
  letterType: LetterType;
  comment?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Full collection detail (case page + edit form). */
export interface CollectionDto {
  id: string;
  caseId: string;
  caseNumber: string;
  contractNumber: string | null;
  borrowerName: string | null;
  branchName: string | null;
  region: string | null;
  status: CollectionStatus;
  months: CollectionMonthDto[];
  penalty: number;
  fine: number;
  totalDebt: number;
  collectedAmount: number;
  note: string | null;
  visits: VisitDto[];
  collector: CollectorRef | null;
  assignedByName: string | null;
  assignedAt: string | null;
  createdByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row shape for the undiruv list + statistics. */
export interface CollectionListItem {
  id: string;
  caseId: string;
  caseNumber: string;
  contractNumber: string | null;
  borrowerName: string | null;
  branchName: string | null;
  region: string | null;
  status: CollectionStatus;
  totalDebt: number;
  collectedAmount: number;
  penalty: number;
  fine: number;
  monthsCount: number;
  collectorId: string | null;
  collectorName: string | null;
  createdByName: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  caseId: string;
  months: CollectionMonthInput[];
  penalty: number;
  fine: number;
  note?: string | null;
  assignedCollectorId?: string | null;
}

export interface UpdateCollectionInput {
  months?: CollectionMonthInput[];
  penalty?: number;
  fine?: number;
  note?: string | null;
  assignedCollectorId?: string | null;
  status?: CollectionStatus;
}

// collector accounts (admin-managed) ──────────────────────────────────────────

export interface CollectorBranchRef {
  id: string;
  name: string;
  symbol: string;
}

export interface CollectorListItem {
  id: string;
  fullName: string;
  login: string;
  /** Admin-visible credential, for handing the collector their login (internal tool). */
  plainPassword: string | null;
  phone: string | null;
  isActive: boolean;
  branches: CollectorBranchRef[];
  activeCount: number; // open collections assigned to them
  createdAt: string;
}

export interface CreateCollectorInput {
  fullName: string;
  /** The phone doubles as the unique login. */
  phone: string;
  /** Optional — min 6 chars; when omitted the server generates a password. */
  password?: string;
  branchIds: string[];
}

export interface UpdateCollectorInput {
  fullName?: string;
  phone?: string | null;
  branchIds?: string[];
  isActive?: boolean;
  password?: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  caseId: string | null;
  read: boolean;
  createdAt: string;
}

// ── access rules (shared so web + backend agree) ──────────────────────────────

/** Roles allowed to create / edit / assign a collection (qarzdorlikni belgilash). */
export function canManageCollection(role: Role): boolean {
  return role === Role.ADMIN || role === Role.DIRECTOR || role === Role.MODERATOR;
}

/** Roles allowed to delete an unclosed collection. */
export function canDeleteCollection(role: Role): boolean {
  return role === Role.ADMIN || role === Role.DIRECTOR;
}

// ── pure logic ────────────────────────────────────────────────────────────────

/** Jami qarzdorlik = Σ(oylar) + penya + shtraf. Negatives are floored at 0. */
export function collectionTotal(input: {
  months: { amount: number }[];
  penalty: number;
  fine: number;
}): number {
  const months = input.months.reduce((s, m) => s + (m.amount || 0), 0);
  const total = months + (input.penalty || 0) + (input.fine || 0);
  return total > 0 ? total : 0;
}

/** Qoldiq = jami − undirilgan, never below zero. */
export function collectionRemaining(totalDebt: number, collected: number): number {
  const r = (totalDebt || 0) - (collected || 0);
  return r > 0 ? r : 0;
}

/** Undirilgan foizi (0..100), 0 when there is no debt. */
export function collectionCollectedPct(totalDebt: number, collected: number): number {
  if (!totalDebt || totalDebt <= 0) return 0;
  const pct = ((collected || 0) / totalDebt) * 100;
  if (pct < 0) return 0;
  return pct > 100 ? 100 : Math.round(pct);
}

export interface CollectionSlice {
  key: string;
  label: string;
  count: number;
  totalDebt: number;
  collected: number;
  remaining: number;
}

export interface CollectionStats {
  count: number;
  activeCount: number; // status !== CLOSED
  closedCount: number;
  totalDebt: number;
  totalCollected: number;
  remaining: number;
  collectedPct: number;
  byStatus: CollectionSlice[];
  byCollector: CollectionSlice[];
  byBranch: CollectionSlice[];
}

/**
 * Roll a set of collection rows up into the sidebar statistics: overall totals plus the
 * by-status, by-collector and by-branch breakdowns. Pure — the same rows produce the same
 * numbers on the server and in the browser.
 */
export function collectionStats(rows: CollectionListItem[]): CollectionStats {
  const totalDebt = sum(rows, (r) => r.totalDebt);
  const totalCollected = sum(rows, (r) => r.collectedAmount);

  const byStatus = groupSlices(
    rows,
    (r) => r.status,
    (r) => r.status,
  );
  const byCollector = groupSlices(
    rows,
    (r) => r.collectorId ?? '∅',
    (r) => r.collectorName ?? 'Biriktirilmagan',
  );
  const byBranch = groupSlices(
    rows,
    (r) => r.branchName ?? '∅',
    (r) => r.branchName ?? 'Filialsiz',
  );

  return {
    count: rows.length,
    activeCount: rows.filter((r) => r.status !== CollectionStatus.CLOSED).length,
    closedCount: rows.filter((r) => r.status === CollectionStatus.CLOSED).length,
    totalDebt,
    totalCollected,
    remaining: collectionRemaining(totalDebt, totalCollected),
    collectedPct: collectionCollectedPct(totalDebt, totalCollected),
    byStatus,
    byCollector,
    byBranch,
  };
}

function sum<T>(rows: T[], get: (r: T) => number): number {
  return rows.reduce((s, r) => s + (get(r) || 0), 0);
}

function groupSlices(
  rows: CollectionListItem[],
  keyOf: (r: CollectionListItem) => string,
  labelOf: (r: CollectionListItem) => string,
): CollectionSlice[] {
  const map = new Map<string, CollectionSlice>();
  for (const r of rows) {
    const key = keyOf(r);
    const slice = map.get(key) ?? { key, label: labelOf(r), count: 0, totalDebt: 0, collected: 0, remaining: 0 };
    slice.count += 1;
    slice.totalDebt += r.totalDebt || 0;
    slice.collected += r.collectedAmount || 0;
    slice.remaining = collectionRemaining(slice.totalDebt, slice.collected);
    map.set(key, slice);
  }
  // Largest debt first — the biggest exposures lead the breakdown.
  return [...map.values()].sort((a, b) => b.totalDebt - a.totalDebt);
}

// ── the undiruv list filter (pure; UI builds the controls) ────────────────────

export interface CollectionFilter {
  statuses: ReadonlySet<CollectionStatus>;
  collectorIds: ReadonlySet<string>;
  branches: ReadonlySet<string>;
  from: string | null;
  to: string | null;
}

export const EMPTY_COLLECTION_FILTER: CollectionFilter = {
  statuses: new Set(),
  collectorIds: new Set(),
  branches: new Set(),
  from: null,
  to: null,
};

export function activeCollectionFilterCount(f: CollectionFilter): number {
  return (
    (f.statuses.size ? 1 : 0) +
    (f.collectorIds.size ? 1 : 0) +
    (f.branches.size ? 1 : 0) +
    (f.from || f.to ? 1 : 0)
  );
}

/** True when the row passes every active dimension of the filter (AND across, OR within). */
export function matchesCollectionFilter(f: CollectionFilter, r: CollectionListItem): boolean {
  if (f.statuses.size && !f.statuses.has(r.status)) return false;
  if (f.collectorIds.size && !(r.collectorId && f.collectorIds.has(r.collectorId))) return false;
  if (f.branches.size && !(r.branchName && f.branches.has(r.branchName))) return false;

  if (f.from || f.to) {
    const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
    if (Number.isNaN(t)) return false;
    if (f.from && t < new Date(f.from).setUTCHours(0, 0, 0, 0)) return false;
    if (f.to && t > new Date(f.to).setUTCHours(23, 59, 59, 999)) return false;
  }
  return true;
}
