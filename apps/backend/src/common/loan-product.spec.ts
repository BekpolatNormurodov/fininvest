import {
  LoanProduct,
  LoanProductKind,
  CollateralRule,
  InsuranceKind,
  TermBand,
  termBandFor,
  SHORT_TERM_MAX_MONTHS,
  loanProductProfile,
  LOAN_PRODUCT_PROFILES,
  LOAN_PRODUCT_ORDER,
  ltvOf,
  collateralRequirementMet,
  assetFinancials,
} from '@credit-core/shared';

describe('loan-product profiles', () => {
  it('has exactly the four products in picker order', () => {
    expect(LOAN_PRODUCT_ORDER).toEqual(['ADM_TEAM', 'OSON', 'AVTO', 'IPOTEKA']);
    expect(Object.keys(LOAN_PRODUCT_PROFILES).sort()).toEqual(
      ['ADM_TEAM', 'AVTO', 'IPOTEKA', 'OSON'],
    );
  });

  it('splits cash products from asset-purchase products', () => {
    expect(loanProductProfile(LoanProduct.ADM_TEAM).kind).toBe(LoanProductKind.CASH);
    expect(loanProductProfile(LoanProduct.OSON).kind).toBe(LoanProductKind.CASH);
    expect(loanProductProfile(LoanProduct.AVTO).kind).toBe(LoanProductKind.ASSET);
    expect(loanProductProfile(LoanProduct.IPOTEKA).kind).toBe(LoanProductKind.ASSET);
  });

  it('keeps the owner-fixed figures: ADM 32% / 36 months, OSON up to 50%', () => {
    const adm = loanProductProfile(LoanProduct.ADM_TEAM);
    expect(adm.rateMinPct).toBe(32);
    expect(adm.maxTermMonths).toBe(36);
    expect(loanProductProfile(LoanProduct.OSON).rateMaxPct).toBe(50);
  });

  it('requires a seller and a 30% down payment only for asset products', () => {
    for (const p of [LoanProduct.ADM_TEAM, LoanProduct.OSON]) {
      expect(loanProductProfile(p).sellerRequired).toBe(false);
      expect(loanProductProfile(p).minDownPayment).toBe(0);
      expect(loanProductProfile(p).collateralRule).toBe(CollateralRule.PLEDGE_COVERAGE);
    }
    for (const p of [LoanProduct.AVTO, LoanProduct.IPOTEKA]) {
      expect(loanProductProfile(p).sellerRequired).toBe(true);
      expect(loanProductProfile(p).minDownPayment).toBe(0.3);
      expect(loanProductProfile(p).collateralRule).toBe(CollateralRule.LTV);
    }
  });

  it('assigns the right insurance kind per product', () => {
    expect(loanProductProfile(LoanProduct.ADM_TEAM).insurance).toBe(InsuranceKind.LOAN_RISK);
    expect(loanProductProfile(LoanProduct.OSON).insurance).toBe(InsuranceKind.LOAN_RISK);
    expect(loanProductProfile(LoanProduct.AVTO).insurance).toBe(InsuranceKind.CAR);
    expect(loanProductProfile(LoanProduct.IPOTEKA).insurance).toBe(InsuranceKind.PROPERTY);
  });
});

describe('term band derivation', () => {
  it('is short at or below the cutoff, long above it', () => {
    expect(termBandFor(SHORT_TERM_MAX_MONTHS)).toBe(TermBand.SHORT);
    expect(termBandFor(6)).toBe(TermBand.SHORT);
    expect(termBandFor(SHORT_TERM_MAX_MONTHS + 1)).toBe(TermBand.LONG);
    expect(termBandFor(36)).toBe(TermBand.LONG);
  });
});

describe('ltv', () => {
  it('is loan over asset value', () => {
    expect(ltvOf(70, 100)).toBeCloseTo(0.7);
    expect(ltvOf(30, 100)).toBeCloseTo(0.3);
  });

  it('is zero when the asset value is missing', () => {
    expect(ltvOf(70, 0)).toBe(0);
  });
});

describe('assetFinancials', () => {
  it('derives LTV and down payment for asset products', () => {
    expect(assetFinancials(LoanProduct.AVTO, 70, 100)).toEqual({ ltvPct: 70, downPaymentPct: 30 });
    expect(assetFinancials(LoanProduct.IPOTEKA, 60, 100)).toEqual({ ltvPct: 60, downPaymentPct: 40 });
  });

  it('is null for cash products', () => {
    expect(assetFinancials(LoanProduct.OSON, 70, 100)).toEqual({ ltvPct: null, downPaymentPct: null });
    expect(assetFinancials(LoanProduct.ADM_TEAM, 70, 100)).toEqual({ ltvPct: null, downPaymentPct: null });
  });

  it('is null when a product, loan, or asset value is missing', () => {
    expect(assetFinancials(null, 70, 100)).toEqual({ ltvPct: null, downPaymentPct: null });
    expect(assetFinancials(LoanProduct.AVTO, null, 100)).toEqual({ ltvPct: null, downPaymentPct: null });
    expect(assetFinancials(LoanProduct.AVTO, 70, 0)).toEqual({ ltvPct: null, downPaymentPct: null });
  });
});

describe('collateral requirement gate (product-aware)', () => {
  // The two cash products stopped sharing a multiple on 2026-07-29: ADM TEAM still wants 140%,
  // OSON 125%. A pledge of 130 covers a 100 loan for OSON and does not for ADM TEAM — that pair is
  // the whole point of the change, so it is asserted rather than implied.
  it('cash products need their own pledge coverage', () => {
    expect(collateralRequirementMet(LoanProduct.ADM_TEAM, { pledgedValue: 140, loanBase: 100 })).toBe(true);
    expect(collateralRequirementMet(LoanProduct.ADM_TEAM, { pledgedValue: 139, loanBase: 100 })).toBe(false);
    expect(collateralRequirementMet(LoanProduct.ADM_TEAM, { pledgedValue: 130, loanBase: 100 })).toBe(false);

    expect(collateralRequirementMet(LoanProduct.OSON, { pledgedValue: 125, loanBase: 100 })).toBe(true);
    expect(collateralRequirementMet(LoanProduct.OSON, { pledgedValue: 130, loanBase: 100 })).toBe(true);
    expect(collateralRequirementMet(LoanProduct.OSON, { pledgedValue: 124, loanBase: 100 })).toBe(false);

    expect(collateralRequirementMet(LoanProduct.OSON, { pledgedValue: 0, loanBase: 0 })).toBe(false);
  });

  it('asset products need the down payment to reach the product minimum', () => {
    expect(collateralRequirementMet(LoanProduct.AVTO, { downPayment: 0.3 })).toBe(true);
    expect(collateralRequirementMet(LoanProduct.AVTO, { downPayment: 0.29 })).toBe(false);
    expect(collateralRequirementMet(LoanProduct.IPOTEKA, { downPayment: 0.4 })).toBe(true);
    expect(collateralRequirementMet(LoanProduct.IPOTEKA, { downPayment: 0 })).toBe(false);
  });

  it('does not judge an asset product by pledge coverage', () => {
    // A big pledge value with no down payment still fails — asset products gate on the down payment.
    expect(collateralRequirementMet(LoanProduct.AVTO, { pledgedValue: 999, loanBase: 1 })).toBe(false);
  });
});
