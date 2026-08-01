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
