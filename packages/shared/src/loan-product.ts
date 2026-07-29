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
  /** Annual interest-rate bounds, percent — the band a moderator may set within. */
  rateMinPct: number;
  rateMaxPct: number;
  /**
   * The rate quoted on the product card and seeded onto a new line, percent.
   *
   * Which end of the band that is says what kind of product it is. OSON is sold «up to 50%», so it
   * opens at its ceiling and a moderator may come down; the rest read «from 32%» and open at the
   * floor. Without this the seeded rate was always the floor, and OSON quoted 32% while its own
   * card promised 50%.
   */
  rateDefaultPct: number;
  maxTermMonths: number;
  collateralRule: CollateralRule;
  insurance: InsuranceKind;
  sellerRequired: boolean;
  /**
   * Late-payment penalty, percent (105 = 105%). Owner-set per product, and a ceiling: OSON's 200%
   * is «up to 200%», seeded onto the line and reducible from there.
   */
  penaltyRatePct: number;
  /**
   * Cash products: the multiple of the loan the pledge must cover (1.4 = 140%).
   * Asset products settle collateral through LTV instead, so this is unused for them.
   */
  coverageTarget: number;
}

export const LOAN_PRODUCT_PROFILES: Record<LoanProduct, LoanProductProfile> = {
  ADM_TEAM: {
    product: LoanProduct.ADM_TEAM,
    kind: LoanProductKind.CASH,
    label: { uz: 'ADM TEAM', ru: 'ADM TEAM' },
    minDownPayment: 0,
    rateMinPct: 32, // owner-fixed
    rateMaxPct: DEFAULT_RATE_MAX,
    rateDefaultPct: 32, // «32%dan» — opens at the floor
    maxTermMonths: 36, // owner-fixed
    collateralRule: CollateralRule.PLEDGE_COVERAGE,
    insurance: InsuranceKind.LOAN_RISK,
    sellerRequired: false,
    penaltyRatePct: 105,
    coverageTarget: 1.4,
  },
  OSON: {
    product: LoanProduct.OSON,
    kind: LoanProductKind.CASH,
    label: { uz: 'OSON', ru: 'ОСОН' },
    minDownPayment: 0,
    // Owner-set 2026-07-29: «up to 50%» a year and «up to 200%» penalty, 60-month line, 125% pledge
    // cover. Both rates are ceilings the moderator may come down from, so the band stays open at
    // the bottom and the product opens at its top. ADM TEAM keeps 32% / 105% / 36 months / 140%.
    rateMinPct: DEFAULT_RATE_MIN,
    rateMaxPct: 50,
    rateDefaultPct: 50, // «50%gacha» — opens at the ceiling
    maxTermMonths: 60,
    collateralRule: CollateralRule.PLEDGE_COVERAGE,
    insurance: InsuranceKind.LOAN_RISK,
    sellerRequired: false,
    penaltyRatePct: 200,
    coverageTarget: 1.25,
  },
  AVTO: {
    product: LoanProduct.AVTO,
    kind: LoanProductKind.ASSET,
    label: { uz: 'Avto kredit', ru: 'Автокредит' },
    minDownPayment: 0.3, // owner-fixed: 30%
    rateMinPct: DEFAULT_RATE_MIN,
    rateMaxPct: DEFAULT_RATE_MAX,
    rateDefaultPct: DEFAULT_RATE_MIN,
    maxTermMonths: 36,
    collateralRule: CollateralRule.LTV,
    insurance: InsuranceKind.CAR,
    sellerRequired: true,
    penaltyRatePct: 105,
    coverageTarget: 1.4, // unused: LTV rule
  },
  IPOTEKA: {
    product: LoanProduct.IPOTEKA,
    kind: LoanProductKind.ASSET,
    label: { uz: 'Ipoteka', ru: 'Ипотека' },
    minDownPayment: 0.3, // owner-fixed: 30–40%, minimum 30%
    rateMinPct: DEFAULT_RATE_MIN,
    rateMaxPct: DEFAULT_RATE_MAX,
    rateDefaultPct: DEFAULT_RATE_MIN,
    maxTermMonths: 120,
    collateralRule: CollateralRule.LTV,
    insurance: InsuranceKind.PROPERTY,
    sellerRequired: true,
    penaltyRatePct: 105,
    coverageTarget: 1.4, // unused: LTV rule
  },
};

/** Penalty rate as a fraction (105% -> 1.05). Falls back to 1.05 when the product is unknown. */
export function penaltyRateFor(p: LoanProduct | null | undefined): number {
  return p ? LOAN_PRODUCT_PROFILES[p].penaltyRatePct / 100 : 1.05;
}

/** Required pledge cover as a multiple (140% -> 1.4). Falls back to 1.4 when unknown. */
export function coverageTargetFor(p: LoanProduct | null | undefined): number {
  return p ? LOAN_PRODUCT_PROFILES[p].coverageTarget : CASH_COVERAGE_TARGET;
}

/** Profile for a product. */
export function loanProductProfile(p: LoanProduct): LoanProductProfile {
  return LOAN_PRODUCT_PROFILES[p];
}

/** Loan-to-value from loan amount and asset value (asset products). 70M / 100M = 0.70. */
export function ltvOf(loanAmount: number, assetValue: number): number {
  if (!assetValue || assetValue <= 0) return 0;
  return loanAmount / assetValue;
}

/** Cash products: pledged value must cover the loan by at least this ratio. */
export const CASH_COVERAGE_TARGET = 1.4;

/**
 * Whether the collateral requirement is met — product-aware, used by the score-report gate.
 * The 20 scoring factors are unchanged; only this gate branches by product.
 *
 * - Cash (OSON, ADM TEAM): a separate pledge must cover the loan by >= 140%.
 * - Asset (AVTO, IPOTEKA): the asset IS the collateral, so instead the client's down payment
 *   must reach the product minimum (equivalently loan <= (1 - minDown) x asset value).
 *
 * `downPayment` is a fraction (0.30 = 30%), matching profile.minDownPayment.
 */
export function collateralRequirementMet(
  product: LoanProduct,
  input: { pledgedValue?: number; loanBase?: number; downPayment?: number },
): boolean {
  const profile = loanProductProfile(product);
  if (profile.collateralRule === CollateralRule.LTV) {
    return (input.downPayment ?? 0) >= profile.minDownPayment;
  }
  const base = input.loanBase ?? 0;
  const pledged = input.pledgedValue ?? 0;
  // Per-product since 2026-07-29: ADM TEAM still wants 140%, OSON 125%.
  return base > 0 && pledged / base >= profile.coverageTarget;
}

/**
 * LTV and down-payment % for an asset product, from the loan and the purchased asset's value.
 * Returns nulls for cash products or when either figure is missing. Down payment = price − loan,
 * so downPaymentPct = (1 − loan/price)×100 and ltvPct = (loan/price)×100. Rounded to 2 decimals.
 */
export function assetFinancials(
  product: LoanProduct | null,
  loan: number | null,
  assetValue: number | null,
): { ltvPct: number | null; downPaymentPct: number | null } {
  const isAsset = product ? loanProductProfile(product).kind === LoanProductKind.ASSET : false;
  if (!isAsset || !loan || !assetValue || assetValue <= 0) return { ltvPct: null, downPaymentPct: null };
  const round2 = (x: number) => Math.round(x * 100) / 100;
  return { ltvPct: round2((loan / assetValue) * 100), downPaymentPct: round2((1 - loan / assetValue) * 100) };
}

/** Display order for the "new application" product picker. */
export const LOAN_PRODUCT_ORDER: LoanProduct[] = [
  LoanProduct.ADM_TEAM,
  LoanProduct.OSON,
  LoanProduct.AVTO,
  LoanProduct.IPOTEKA,
];
