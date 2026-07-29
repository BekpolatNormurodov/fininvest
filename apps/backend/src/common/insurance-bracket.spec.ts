import { insurancePremiumRate, originationCalc, INSURANCE_MAX_MONTHS } from '@credit-core/shared';

// The bracket boundary moved from 24 to 12 months on 2026-07-29 (owner-set): a two-year policy is
// charged 4%, where it used to be 2%. These cases sit either side of the new edge so a silent move
// back shows up here.
describe('insurancePremiumRate (flat bracket)', () => {
  it('≤12 months → 2%', () => {
    expect(insurancePremiumRate(1)).toBe(0.02);
    expect(insurancePremiumRate(6)).toBe(0.02);
    expect(insurancePremiumRate(12)).toBe(0.02);
  });
  it('over 12 months → 4%', () => {
    expect(insurancePremiumRate(13)).toBe(0.04);
    expect(insurancePremiumRate(24)).toBe(0.04);
    expect(insurancePremiumRate(48)).toBe(0.04);
  });
  it('0 / absent → 0', () => {
    expect(insurancePremiumRate(0)).toBe(0);
    expect(insurancePremiumRate(null)).toBe(0);
  });
  it('max term is 48 months (4 years)', () => {
    expect(INSURANCE_MAX_MONTHS).toBe(48);
  });
});

describe('originationCalc premium (flat bracket)', () => {
  it('200M polis, ≤1yr → 260M insured × 2% = 5.2M', () => {
    const c = originationCalc({ loanUnderPolicy: 200_000_000, policyTermMonths: 12 });
    expect(c.insuredSum).toBe(260_000_000);
    expect(c.premium).toBe(5_200_000);
  });
  it('same 200M polis, over 1yr → 260M × 4% = 10.4M', () => {
    const c = originationCalc({ loanUnderPolicy: 200_000_000, policyTermMonths: 24 });
    expect(c.premium).toBe(10_400_000);
  });
});
