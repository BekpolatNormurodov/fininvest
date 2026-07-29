import { originationPersistedValues } from '@credit-core/shared';

describe('originationPersistedValues', () => {
  it('derives loanType, amount, insuredSum, premium, newLoanPayment', () => {
    const v = originationPersistedValues({
      amountTotal: 130_000_000, loanUnderPolicy: 60_000_000, insuranceRate: 0.02, policyTermMonths: 24, trancheMonthlyPayment: 8_060_000,
    });
    expect(v.loanType).toBe('MICROCREDIT');
    expect(v.amount).toBe(130_000_000);
    expect(v.insuredSum).toBe(78_000_000);
    // Flat bracket: 78M × 4%. The 24-month policy was 2% until the boundary moved from 24 to 12
    // months on 2026-07-29 — the stored premium follows the same function the form quotes from.
    expect(v.premium).toBe(3_120_000);
    expect(v.newLoanPayment).toBe(8_060_000);
  });
  it('handles empty input (microloan, nulls, zero premium)', () => {
    const v = originationPersistedValues({});
    expect(v.loanType).toBe('MICROLOAN');
    expect(v.amount).toBeNull();
    expect(v.premium).toBe(0);
    expect(v.newLoanPayment).toBeNull();
  });
});
