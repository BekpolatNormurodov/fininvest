/**
 * Loan products for fin-invest — four commercial products over one lending engine.
 *
 * OSON and ADM TEAM are cash microloans: money to the client, a separate pledge secures
 * the loan. AVTO and IPOTEKA are asset-purchase loans: money to the seller, and the
 * purchased asset itself is the collateral.
 *
 * The business figures live here as seeded defaults. The ones fixed by the owner are:
 * ADM TEAM from 32% / up to 36 months, OSON up to 50%, down payment 30% (auto) and
 * 30–40% (ipoteka). Values NOT fixed by the owner (avto/ipoteka rate, OSON floor,
 * ADM ceiling) use the DEFAULT_RATE_* provisional bounds and are meant to be tuned
 * without touching logic — see the spec's product table.
 */

/** The four products. OSON and ADM TEAM are separate products, not one "cash" bucket. */
export const LoanProduct = {
  ADM_TEAM: 'ADM_TEAM',
  OSON: 'OSON',
  AVTO: 'AVTO',
  IPOTEKA: 'IPOTEKA',
} as const;
export type LoanProduct = (typeof LoanProduct)[keyof typeof LoanProduct];

/** Cash microloan (separate pledge) vs asset-purchase (the asset is the collateral). */
export const LoanProductKind = { CASH: 'CASH', ASSET: 'ASSET' } as const;
export type LoanProductKind = (typeof LoanProductKind)[keyof typeof LoanProductKind];

/** Derived from the entered term — never chosen by the user. */
export const TermBand = { SHORT: 'SHORT', LONG: 'LONG' } as const;
export type TermBand = (typeof TermBand)[keyof typeof TermBand];

/** How the collateral factor is measured for a product. */
export const CollateralRule = { PLEDGE_COVERAGE: 'PLEDGE_COVERAGE', LTV: 'LTV' } as const;
export type CollateralRule = (typeof CollateralRule)[keyof typeof CollateralRule];

/** Insurance kind a product requires. */
export const InsuranceKind = { LOAN_RISK: 'LOAN_RISK', PROPERTY: 'PROPERTY', CAR: 'CAR' } as const;
export type InsuranceKind = (typeof InsuranceKind)[keyof typeof InsuranceKind];

/** Term at or below this many months is краткосрочный (SHORT), otherwise долгосрочный (LONG). */
export const SHORT_TERM_MAX_MONTHS = 12;

/** Provisional rate bounds for products/edges the owner has not fixed yet. */
export const DEFAULT_RATE_MIN = 32;
export const DEFAULT_RATE_MAX = 50;

/** Short vs long term band, derived from the entered term in months. */
export function termBandFor(termMonths: number): TermBand {
  return termMonths <= SHORT_TERM_MAX_MONTHS ? TermBand.SHORT : TermBand.LONG;
}

/** Uzbek / Russian display for the derived term band. */
export const TERM_BAND_LABEL: Record<TermBand, { uz: string; ru: string }> = {
  SHORT: { uz: 'Qisqa muddatli', ru: 'краткосрочный' },
  LONG: { uz: 'Uzoq muddatli', ru: 'долгосрочный' },
};

export interface LoanProductProfile {
  product: LoanProduct;
  kind: LoanProductKind;
  label: { uz: string; ru: string };
  /** Minimum client down payment as a fraction (0.30 = 30%). 0 for cash products. */
  minDownPayment: number;
  /** Annual interest-rate bounds, percent. */
  rateMinPct: number;
  rateMaxPct: number;
  maxTermMonths: number;
  collateralRule: CollateralRule;
  insurance: InsuranceKind;
  sellerRequired: boolean;
}

export const LOAN_PRODUCT_PROFILES: Record<LoanProduct, LoanProductProfile> = {
  ADM_TEAM: {
    product: LoanProduct.ADM_TEAM,
    kind: LoanProductKind.CASH,
    label: { uz: 'ADM TEAM', ru: 'ADM TEAM' },
    minDownPayment: 0,
    rateMinPct: 32, // owner-fixed
    rateMaxPct: DEFAULT_RATE_MAX,
    maxTermMonths: 36, // owner-fixed
    collateralRule: CollateralRule.PLEDGE_COVERAGE,
    insurance: InsuranceKind.LOAN_RISK,
    sellerRequired: false,
  },
  OSON: {
    product: LoanProduct.OSON,
    kind: LoanProductKind.CASH,
    label: { uz: 'OSON', ru: 'ОСОН' },
    minDownPayment: 0,
    rateMinPct: DEFAULT_RATE_MIN,
    rateMaxPct: 50, // owner-fixed: up to 50%
    maxTermMonths: 24,
    collateralRule: CollateralRule.PLEDGE_COVERAGE,
    insurance: InsuranceKind.LOAN_RISK,
    sellerRequired: false,
  },
  AVTO: {
    product: LoanProduct.AVTO,
    kind: LoanProductKind.ASSET,
    label: { uz: 'Avto kredit', ru: 'Автокредит' },
    minDownPayment: 0.3, // owner-fixed: 30%
    rateMinPct: DEFAULT_RATE_MIN,
    rateMaxPct: DEFAULT_RATE_MAX,
    maxTermMonths: 36,
    collateralRule: CollateralRule.LTV,
    insurance: InsuranceKind.CAR,
    sellerRequired: true,
  },
  IPOTEKA: {
    product: LoanProduct.IPOTEKA,
    kind: LoanProductKind.ASSET,
    label: { uz: 'Ipoteka', ru: 'Ипотека' },
    minDownPayment: 0.3, // owner-fixed: 30–40%, minimum 30%
    rateMinPct: DEFAULT_RATE_MIN,
    rateMaxPct: DEFAULT_RATE_MAX,
    maxTermMonths: 120,
    collateralRule: CollateralRule.LTV,
    insurance: InsuranceKind.PROPERTY,
    sellerRequired: true,
  },
};

/** Profile for a product. */
export function loanProductProfile(p: LoanProduct): LoanProductProfile {
  return LOAN_PRODUCT_PROFILES[p];
}

/** Loan-to-value from loan amount and asset value (asset products). 70M / 100M = 0.70. */
export function ltvOf(loanAmount: number, assetValue: number): number {
  if (!assetValue || assetValue <= 0) return 0;
  return loanAmount / assetValue;
}

/** Display order for the "new application" product picker. */
export const LOAN_PRODUCT_ORDER: LoanProduct[] = [
  LoanProduct.ADM_TEAM,
  LoanProduct.OSON,
  LoanProduct.AVTO,
  LoanProduct.IPOTEKA,
];
