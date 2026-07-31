import { trancheAmountViolations, trancheAmountWarnings, loanRuleViolations, RepaymentMethod } from '@credit-core/shared';

/*
  Case BR-2026-0002 opened a 110 000 000 line and drew 1 100 000 — two zeros short. Nothing objected,
  the payment came out at 80 972, and the two payment-ratio factors then scored 43 of the case's 65
  points on a figure that was 0.07% of the loan.

  The rule is deliberately narrow. A minimum-share rule would have caught it too, and would also have
  refused a legitimate fifth tranche — this repo's own reference case draws 86.7% of its line, and the
  workbook allows five. Being exactly a power of ten out is a keyboard slip and nothing else.
*/
describe('tranche amount against its line', () => {
  const drew = (line: number, tranche: number) => trancheAmountViolations(line, [tranche]);

  it('refuses the case that got through: 110 mln line, 1.1 mln drawn', () => {
    const errs = drew(110_000_000, 1_100_000);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('100 barobar');
  });

  it('refuses the other power-of-ten slips', () => {
    expect(drew(110_000_000, 11_000_000)[0]).toContain('10 barobar');
    expect(drew(110_000_000, 110_000)[0]).toContain('1000 barobar');
  });

  it('refuses drawing more than the line — a line is a ceiling', () => {
    expect(drew(100_000_000, 120_000_000)[0]).toContain('oshib ketdi');
    expect(drew(100_000_000, 100_000_001)).toHaveLength(1);
  });

  it('leaves every legitimate drawdown alone, including a small late tranche', () => {
    expect(drew(150_000_000, 130_000_000)).toEqual([]); // the repo's own reference case, 86.7%
    expect(drew(150_000_000, 5_000_000)).toEqual([]); // a fifth tranche at 3.3% — real, not a slip
    expect(drew(110_000_000, 110_000_000)).toEqual([]); // drawn in full
    expect(drew(110_000_000, 11_000_001)).toEqual([]); // near a factor of ten, but not on it
  });

  it('says nothing when there is nothing to compare', () => {
    expect(trancheAmountViolations(null, null)).toEqual([]);
    expect(trancheAmountViolations(110_000_000, [])).toEqual([]);
    expect(trancheAmountViolations(110_000_000, [null])).toEqual([]);
    expect(trancheAmountViolations(0, [1_000])).toEqual([]);
  });

  it('sums the tranches rather than judging them one by one', () => {
    // Three drawdowns filling the line exactly — fine; one more over it — not.
    expect(trancheAmountViolations(90_000_000, [30_000_000, 30_000_000, 30_000_000])).toEqual([]);
    expect(trancheAmountViolations(90_000_000, [30_000_000, 30_000_000, 30_000_001])).toHaveLength(1);
  });

  it('warns about a small drawdown without refusing it', () => {
    expect(trancheAmountWarnings(150_000_000, [5_000_000])[0]).toContain('3%');
    expect(trancheAmountWarnings(150_000_000, [130_000_000])).toEqual([]);
    // An amount already refused is not also warned about — one message, not two.
    expect(trancheAmountWarnings(110_000_000, [1_100_000])).toEqual([]);
  });

  it('is enforced by the server-side rule guard, not only at the field', () => {
    const errs = loanRuleViolations({
      scheduleType: RepaymentMethod.DIFFERENTIATED,
      trancheTermMonths: 36,
      lineTermMonths: 60,
      amountTotal: 110_000_000,
      tranchePrincipals: [1_100_000],
    });
    expect(errs.some((e) => e.includes('100 barobar'))).toBe(true);
  });
});
