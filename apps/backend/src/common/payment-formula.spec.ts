import { monthlyPaymentFor, paymentDayFor, PAYMENT_DAY_CAP, RepaymentMethod } from '@credit-core/shared';

/*
  «и экзаельда формула бор.»

  The two numbers a client is quoted — the monthly payment and the day it falls due — were computed
  by code that nothing tested against the workbook. Zero tests referenced PAYMENT_DAY_CAP and none
  asserted a payment figure the workbook produces, so either could have drifted silently.

  These are the locks. They are written as the workbook's own cells so that a future change to
  either has to be a deliberate edit to a stated figure, not a side effect.
*/
describe('the monthly payment is the workbook PMT', () => {
  /*
    ROUND(PMT(rate/12, nper, -P), 2) on 150 000 000 / 24 months / 55% = 10 434 290.17.

    We round to the whole so'm, so 10 434 290 — a 17-tiyin difference from the sheet and the only
    one. Asserted as the literal figure rather than by recomputing the same formula, which would
    only prove the code agrees with itself.
  */
  it('annuity: 150M / 24 oy / 55% is 10 434 290', () => {
    expect(monthlyPaymentFor(RepaymentMethod.ANNUITY, 150_000_000, 24, 0.55)).toBe(10_434_290);
  });

  // P/n + P*r/12 — the first month's payment, which is the largest and the one quoted.
  it('differentiated: the same loan opens at 13 125 000', () => {
    expect(monthlyPaymentFor(RepaymentMethod.DIFFERENTIATED, 150_000_000, 24, 0.55)).toBe(13_125_000);
  });

  it('a zero rate is P/n, not a division by zero', () => {
    expect(monthlyPaymentFor(RepaymentMethod.ANNUITY, 150_000_000, 24, 0)).toBe(6_250_000);
  });

  it('refuses to invent a payment when the method is unknown', () => {
    expect(monthlyPaymentFor(null, 150_000_000, 24, 0.55)).toBeNull();
  });
});

describe('the payment day is the formalization day, capped', () => {
  /*
    The cap is stated here as a literal so that changing it is a change to this line too.

    It is worth knowing where 15 comes from, because the workbooks do not agree with each other.
    Measured across all seven reference files, the DAY() cap formula reads:

      sheet17          15   in six of seven workbooks; 10 in «АВТО мфл APEX (2).xlsx» alone
      sheets 18–23     25   in all seven

    So «15» matches only the first schedule sheet, and only in the majority of books; every other
    schedule sheet caps at 25. Both divergences are real and neither is settled — see the note in
    origination.ts. This test pins what the code does today; it does not claim the workbook agrees.
  */
  it('caps at the 15th', () => {
    expect(PAYMENT_DAY_CAP).toBe(15);
  });

  it('formalized before the cap, the client pays on that day', () => {
    expect(paymentDayFor('2026-03-07T00:00:00.000Z')).toBe(7);
    expect(paymentDayFor('2026-03-15T00:00:00.000Z')).toBe(15);
  });

  it('formalized after the cap, the client is moved back to it', () => {
    expect(paymentDayFor('2026-03-20T00:00:00.000Z')).toBe(15);
    expect(paymentDayFor('2026-03-31T00:00:00.000Z')).toBe(15);
  });

  it('no date, no day — never a fabricated 1st', () => {
    expect(paymentDayFor(null)).toBeNull();
    expect(paymentDayFor(undefined)).toBeNull();
    expect(paymentDayFor('')).toBeNull();
  });
});
