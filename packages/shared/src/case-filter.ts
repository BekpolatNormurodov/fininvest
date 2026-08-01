import type { CreditCaseListItem } from './dto';
import type { LoanProduct } from './loan-product';

/**
 * The applications-list filter, as pure data logic.
 *
 * It lives in shared, next to CreditCaseListItem, rather than in the filter-bar component, so the
 * matching rules are testable without a browser and cannot drift from the DTO they read. The UI owns
 * only the controls that build this state.
 *
 * Every dimension is AND-ed; within a dimension the selected values are OR-ed (a case in any chosen
 * region passes the region filter). An empty dimension does not filter.
 */
export interface CaseFilter {
  /** Selected lending products; empty = any. */
  products: ReadonlySet<LoanProduct>;
  /** Selected branch regions; empty = any. */
  regions: ReadonlySet<string>;
  /** Selected branch names; empty = any. */
  branches: ReadonlySet<string>;
  /** '' = any, 'yes' = insured only, 'no' = uninsured only. */
  insured: '' | 'yes' | 'no';
  /** Created-at day range (ISO), inclusive of both endpoints' whole days; null = open. */
  from: string | null;
  to: string | null;
}

export const EMPTY_CASE_FILTER: CaseFilter = {
  products: new Set(),
  regions: new Set(),
  branches: new Set(),
  insured: '',
  from: null,
  to: null,
};

/** How many dimensions are actually narrowing the list — drives the «Tozalash» button and a count. */
export function activeFilterCount(f: CaseFilter): number {
  return (
    (f.products.size ? 1 : 0) +
    (f.regions.size ? 1 : 0) +
    (f.branches.size ? 1 : 0) +
    (f.insured ? 1 : 0) +
    (f.from || f.to ? 1 : 0)
  );
}

/**
 * The quick date ranges the filter offers, resolved against a reference «today».
 *
 * `now` is passed in rather than read from the clock so the result is deterministic and testable;
 * the UI passes `new Date()`. Days are stamped as UTC midnight of the calendar day — the same
 * convention the date picker and matchesCaseFilter use — so a preset and a hand-picked date compare
 * identically.
 */
export type DatePresetKey = 'last7' | 'last30' | 'prevMonth' | 'thisYear' | 'lastYear';

export const DATE_PRESET_LABELS: Record<DatePresetKey, string> = {
  last7: 'So‘nggi 7 kun',
  last30: 'So‘nggi 30 kun',
  prevMonth: 'O‘tgan oy',
  thisYear: 'Shu yil',
  lastYear: 'O‘tgan yil',
};
export const DATE_PRESET_ORDER: DatePresetKey[] = ['last7', 'last30', 'prevMonth', 'thisYear', 'lastYear'];

const utcDay = (y: number, m: number, d: number): string => new Date(Date.UTC(y, m, d)).toISOString();

export function datePreset(key: DatePresetKey, now: Date): { from: string; to: string } {
  // Read the calendar day off `now` and rebuild it as UTC midnight, so «today» is the day the user sees.
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const today = utcDay(y, m, d);
  switch (key) {
    case 'last7': return { from: utcDay(y, m, d - 6), to: today };   // today plus the six before it
    case 'last30': return { from: utcDay(y, m, d - 29), to: today };
    case 'prevMonth': return { from: utcDay(y, m - 1, 1), to: utcDay(y, m, 0) }; // 1st .. last day of last month
    case 'thisYear': return { from: utcDay(y, 0, 1), to: today };
    case 'lastYear': return { from: utcDay(y - 1, 0, 1), to: utcDay(y - 1, 11, 31) };
  }
}

/** True when the row passes every active dimension of the filter. */
export function matchesCaseFilter(f: CaseFilter, r: CreditCaseListItem): boolean {
  if (f.products.size && !(r.product && f.products.has(r.product))) return false;
  if (f.regions.size && !(r.region && f.regions.has(r.region))) return false;
  if (f.branches.size && !(r.branchName && f.branches.has(r.branchName))) return false;
  if (f.insured === 'yes' && !r.insured) return false;
  if (f.insured === 'no' && r.insured) return false;

  if (f.from || f.to) {
    // Compare by day: `to` includes the whole of its own day, so a case created any time on the
    // end date still matches. A row with no createdAt (should not happen) is treated as out of range.
    const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
    if (Number.isNaN(t)) return false;
    if (f.from && t < new Date(f.from).setUTCHours(0, 0, 0, 0)) return false;
    if (f.to && t > new Date(f.to).setUTCHours(23, 59, 59, 999)) return false;
  }
  return true;
}
