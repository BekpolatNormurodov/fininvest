import {
  loanTypeFor, LoanType, isTermValid, RepaymentMethod, originationCalc, sectorRiskCode, monthlyPaymentFor,
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

/*
  Д1!D43 — `IF(Д3!B11>36, Д1!D47, Д3!B18)`.

  Past three years the sheet stops sizing income against this instalment and sizes it against the
  same debt repaid in three. Without that, stretching the term is a way to make any loan look
  affordable: the instalment falls, the requirement falls with it, and nothing asks whether the
  borrower could carry the debt at all. It matters more now than it did — OSON runs to 60 months.

  Everything except the requirement stays on the real payment, as балл!C27 does.
*/
describe('income sizing over a long term (Д1!D43)', () => {
  const P = 130_000_000;
  const R = 0.32;
  const sized = (termMonths: number) => {
    const actual = monthlyPaymentFor('DIFFERENTIATED', P, termMonths, R);
    const calc = originationCalc({
      existingCreditBurden: 0, newLoanPayment: actual,
      repaymentMethod: 'DIFFERENTIATED', tranchePrincipal: P, trancheTermMonths: termMonths, annualRate: R,
    });
    return { actual, calc };
  };

  it('leaves a tranche of three years or less exactly as it was', () => {
    for (const term of [12, 24, 36]) {
      const { actual, calc } = sized(term);
      expect(calc.minRequiredIncome).toBe(originationCalc({ newLoanPayment: actual }).minRequiredIncome);
    }
  });

  it('sizes a longer tranche on its 36-month equivalent, so stretching the term buys nothing', () => {
    const at36 = sized(36);
    for (const term of [48, 60]) {
      const { actual, calc } = sized(term);
      expect(actual).toBeLessThan(at36.actual!);              // the instalment does fall
      expect(calc.minRequiredIncome).toBe(at36.calc.minRequiredIncome); // the requirement does not
    }
  });

  it('falls back to the real payment when the caller passes no tranche shape', () => {
    // CaseView and Summary pass it; anything older must not change behaviour.
    expect(originationCalc({ newLoanPayment: 5_000_000 }).minRequiredIncome).toBe(11_000_000);
  });

  it('never moves DTI, surplus or the expense total — those follow the real instalment', () => {
    const { actual, calc } = sized(60);
    const plain = originationCalc({ mainActivityIncome: 20_000_000, newLoanPayment: actual });
    const stressed = originationCalc({
      mainActivityIncome: 20_000_000, newLoanPayment: actual,
      repaymentMethod: 'DIFFERENTIATED', tranchePrincipal: P, trancheTermMonths: 60, annualRate: R,
    });
    expect(stressed.dtiRatio).toBe(plain.dtiRatio);
    expect(stressed.surplus).toBe(plain.surplus);
    expect(stressed.totalExpenses).toBe(plain.totalExpenses);
    expect(calc.minRequiredIncome).toBeGreaterThan(plain.minRequiredIncome);
  });
});
