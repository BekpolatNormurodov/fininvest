import { LoanProduct, loanProductProfile, LoanProductKind } from '@credit-core/shared';
import type { CaseDocData } from '../case-document.loader';

/**
 * True when the case buys an asset (AVTO / IPOTEKA) rather than handing over cash.
 *
 * Two documents come in two forms — the микроқарз шартномаси and the бош келишув — and the product
 * decides which one the client signs. Shared by both so the split cannot drift: a case signing the
 * APEX contract but the cash бош келишув would be a dossier of two different agreements.
 */
export function isAssetProduct(c: CaseDocData): boolean {
  const product = c.product as LoanProduct | null | undefined;
  if (!product) return false;
  return loanProductProfile(product)?.kind === LoanProductKind.ASSET;
}
