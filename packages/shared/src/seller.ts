/**
 * Seller / distributor checks for asset-purchase products (AVTO, IPOTEKA).
 *
 * The seller must own the asset they are selling. We compare the seller's name to the owner
 * named on the asset's cadastre (property) or tech passport (car). A mismatch is a WARNING,
 * never a block — consistent with how scoring does not gate the workflow; a later review stage
 * resolves it.
 *
 * Only INDIVIDUAL sellers are checked. A dealer or developer (LEGAL) sells a new asset via
 * invoice / DDU and is not the titled owner, so there is nothing to match against.
 */

import { SellerKind } from './enums';

/** Lower-case, strip dots/commas, collapse whitespace. */
function normName(s?: string | null): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether two personal names plausibly denote the same person, tolerant of initials.
 * "Исмоилов Б А" matches "Исмоилов Бахром Ахрор" — surnames equal, each initial is a prefix.
 * Requires the surname (first token) to match; compares the shared leading tokens.
 */
export function namesLikelySame(a?: string | null, b?: string | null): boolean {
  const at = normName(a).split(' ').filter(Boolean);
  const bt = normName(b).split(' ').filter(Boolean);
  if (!at.length || !bt.length) return false;
  const n = Math.min(at.length, bt.length);
  for (let i = 0; i < n; i++) {
    const x = at[i];
    const y = bt[i];
    if (x === y) continue;
    // one side is an initial (single letter) that begins the other
    if ((x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y))) continue;
    return false;
  }
  return true;
}

/**
 * A warning when the seller does not appear to own the asset, else null. Never blocks.
 * `assetOwnerName` is the owner read from the cadastre / tech passport.
 */
export function sellerOwnershipWarning(input: {
  sellerKind: SellerKind;
  sellerName?: string | null;
  assetOwnerName?: string | null;
}): string | null {
  if (input.sellerKind === SellerKind.LEGAL) return null; // dealer/developer sells via invoice/DDU
  const owner = (input.assetOwnerName ?? '').trim();
  if (!owner) return null; // nothing to compare against
  if (namesLikelySame(input.sellerName, owner)) return null;
  return `Sotuvchi hujjatdagi mulk egasiga mos kelmasligi mumkin: «${(input.sellerName ?? '').trim() || '—'}» ↔ «${owner}». Tekshiring.`;
}
