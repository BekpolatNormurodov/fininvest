import { scheduleForCase } from './schedule';
import { mockCaseDoc } from './__fixtures__/case-doc.fixture';

/*
  The payment schedule, against the workbook's own formulas.

  «График N мес» is identical in every reference file, TRUST and APEX alike:

    F (interest)  = C × I3 / 365 × (Bₙ − Bₙ₋₁)     balance × annual rate ÷ 365 × ACTUAL days
    D (principal) row 1        PPMT(I3/12, 1, I2, −C8)
                  rows 2..n−1  I6 − F
                  row n        = C                 the remaining balance
    G (total)     row 1        D + F               unrounded
                  rows 2..n    CEILING(D + F, 1000)

  We priced interest at balance × rate/12 with no rounding. The monthly payment came out the same
  either way — both derive it from the same PMT — so nothing looked wrong on the page. What differed
  was the split printed in the «асосий қарз» and «фоизлар» columns, and the total.

  The figures below are computed from those formulas rather than copied from a rendered sheet, so
  they can be re-derived from the doc comment above.
*/
const CASE = (o: Record<string, unknown> = {}) =>
  mockCaseDoc({
    amount: 150_000_000,
    creditLine: {
      amountTotal: 150_000_000,
      interestRate: 0.55 as never,
      tranches: [{
        principal: 150_000_000, termMonths: 24, scheduleType: 'ANNUITY',
        applicationDate: new Date('2026-01-06T00:00:00.000Z'),
        contractDate: new Date('2026-01-06T00:00:00.000Z'),
        paymentDay: 6, schedule: null, ...o,
      } as never],
    } as never,
  });

describe('interest follows the days in the period, not a twelfth of a year', () => {
  it('a 28-day February charges less than a 31-day January on a similar balance', () => {
    const s = scheduleForCase(CASE())!;
    const [feb, mar] = [s.installments[0], s.installments[1]];
    expect(feb.days).toBe(31);
    expect(mar.days).toBe(28);
    // Balance is LOWER in March and the month is shorter — both push the interest down.
    expect(mar.interest).toBeLessThan(feb.interest);
    // …and by more than the balance alone explains: 28/31 of a month, not 30/30.
    expect(mar.interest / mar.openingBalance).toBeCloseTo(0.55 / 365 * 28, 6);
  });

  it('row 1 runs from the disbursement date, which is rarely a whole month', () => {
    // Drawn on the 20th, paying on the 6th — the first period is 17 days, not a month.
    const s = scheduleForCase(CASE({
      applicationDate: new Date('2026-01-20T00:00:00.000Z'),
      contractDate: new Date('2026-01-20T00:00:00.000Z'),
    }))!;
    expect(s.installments[0].days).toBe(17);
    expect(s.installments[0].interest).toBeCloseTo(150_000_000 * 0.55 / 365 * 17, 4);
  });
});

describe('the total is rounded up to the thousand, from row 2', () => {
  it('every row after the first lands on a whole thousand', () => {
    const s = scheduleForCase(CASE())!;
    for (const i of s.installments.slice(1)) expect(i.total % 1000).toBe(0);
  });

  // The sheet leaves row 1 unrounded — G8 = D8 + F8, with no CEILING around it.
  it('row 1 is not rounded', () => {
    const s = scheduleForCase(CASE())!;
    const first = s.installments[0];
    expect(first.total).toBeCloseTo(first.principal + first.interest, 4);
  });
});

describe('the schedule closes on zero', () => {
  /*
    Day-count interest makes each row's principal differ from the annuity's, so the balance does not
    land on zero by itself — it ends 527 530 so'm past it on this line. The sheet's last row repays
    «= C», whatever is left, which is what absorbs that.
  */
  it('the final row repays the whole remaining balance', () => {
    const s = scheduleForCase(CASE())!;
    const last = s.installments[23];
    expect(last.principal).toBe(last.openingBalance);
    expect(last.openingBalance - last.principal).toBe(0);
  });

  it('the principal column sums to the loan, to the so\'m', () => {
    const s = scheduleForCase(CASE())!;
    const repaid = s.installments.reduce<number>((t, i) => t + i.principal, 0);
    expect(Math.round(repaid)).toBe(150_000_000);
  });

  it('no row repays more than is outstanding', () => {
    for (const i of scheduleForCase(CASE())!.installments) {
      expect(i.principal).toBeLessThanOrEqual(i.openingBalance + 1e-6);
      expect(i.principal).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the differentiated method keeps its equal principal', () => {
  it('every row but the last repays the same principal', () => {
    const s = scheduleForCase(CASE({ scheduleType: 'DIFFERENTIATED' }))!;
    for (const i of s.installments.slice(0, 23)) expect(i.principal).toBeCloseTo(150_000_000 / 24, 6);
    expect(s.installments[23].principal).toBe(s.installments[23].openingBalance);
  });

  it('interest still follows the day count', () => {
    const s = scheduleForCase(CASE({ scheduleType: 'DIFFERENTIATED' }))!;
    const r = s.installments[1];
    expect(r.interest).toBeCloseTo(r.openingBalance * 0.55 / 365 * r.days, 4);
  });
});
