import {
  loanTypeFor, LoanType, isTermValid, RepaymentMethod, originationCalc, sectorRiskCode,
} from '@credit-core/shared';

describe('origination business rules', () => {
  it('loan type splits at 100M', () => {
    expect(loanTypeFor(100_000_000)).toBe(LoanType.MICROLOAN);
    expect(loanTypeFor(100_000_001)).toBe(LoanType.MICROCREDIT);
    expect(loanTypeFor(130_000_000)).toBe(LoanType.MICROCREDIT);
  });

  it('term caps: annuity ≤30, differential ≤48', () => {
    expect(isTermValid(RepaymentMethod.ANNUITY, 30)).toBe(true);
    expect(isTermValid(RepaymentMethod.ANNUITY, 31)).toBe(false);
    expect(isTermValid(RepaymentMethod.DIFFERENTIATED, 48)).toBe(true);
    expect(isTermValid(RepaymentMethod.DIFFERENTIATED, 49)).toBe(false);
  });

  it('sector risk code lookup', () => {
    expect(sectorRiskCode('Бытовые услуги / Сервисные центры / Автосервис')).toBe(10);
  });
});

describe('originationCalc (TADJIYEV fixture)', () => {
  const calc = originationCalc({
    mainActivityIncome: 18_838_000,
    existingCreditBurden: 502_353,
    newLoanPayment: 8_060_000,
    utilitiesExpense: 190_000,
    familyExpense: 290_000,
    otherExpense: 100_000,
    loanUnderPolicy: 60_000_000,
    insuranceRate: 0.02,
    policyTermMonths: 24,
    amountTotal: 130_000_000,
    collateralTotal: 126_000_000,
  });

  it('income, expenses, DTI, surplus', () => {
    expect(calc.totalIncome).toBe(18_838_000);
    expect(calc.totalCreditPayments).toBe(8_562_353);
    expect(calc.totalExpenses).toBe(9_142_353);
    expect(Number(calc.dtiRatio.toFixed(4))).toBe(0.4545);
    expect(calc.surplus).toBe(9_695_647);
  });

  it('min required income (2.2× round up to 1000)', () => {
    expect(calc.minRequiredIncome).toBe(18_838_000);
  });

  it('insurance: insuredSum 1.3×, flat-bracket premium (over 12 oy → 4%)', () => {
    expect(calc.insuredSum).toBe(78_000_000);
    // The fixture's policy runs 24 months. That was 2% until the bracket moved to 12 months on
    // 2026-07-29; the same policy now costs 4%.
    expect(calc.premium).toBe(3_120_000); // 78M × 4%
  });

  it('affordability ok when surplus≥0 and income≥required', () => {
    expect(calc.affordabilityOk).toBe(true);
  });
});
