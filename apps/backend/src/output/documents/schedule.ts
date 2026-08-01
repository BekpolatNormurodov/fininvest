import { pmt, paymentDayFor, trancheAmountViolations } from '@credit-core/shared';
import type { CaseDocData } from './case-document.loader';

/** One amortization row, in the shape both the grafik PDF and the Excel export render. */
export interface DocInstallment {
  seq: number;
  dueDate: Date;
  openingBalance: number;
  principal: number;
  interest: number;
  total: number;
  days: number;
}

/** A resolved payment schedule for a tranche — persisted if one exists, otherwise computed live. */
export interface DocSchedule {
  principal: number;
  termMonths: number;
  annualRate: number; // fraction, e.g. 0.55
  disbursementDate: Date;
  method: 'ANNUITY' | 'DIFFERENTIATED';
  installments: DocInstallment[];
}

/** Add `months` to `base` and clamp the day so 31 Jan + 1 oy → 28/29 Feb, never rolls to March. */
function addMonthsClamped(base: Date, months: number, day: number): Date {
  const d = new Date(base);
  d.setDate(1); // avoid overflow while shifting the month
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

const daysBetween = (a: Date, b: Date): number =>
  Math.max(0, Math.round((a.getTime() - b.getTime()) / 86_400_000));

/**
 * Resolve the payment schedule for a case's first tranche.
 *
 * The backend does not persist installment rows, so a schedule almost never exists in the DB — the
 * grafik/Excel documents used to show "Тўлов жадвали ҳисобланмаган" forever. Instead we compute the
 * schedule ON DEMAND from the tranche parameters (principal, term, annual rate, method, disbursement
 * date, payment day) every time a document is generated, so it always reflects the current data.
 * A persisted schedule, if one is ever generated, is still honored as authoritative.
 *
 * Returns null only when the inputs are genuinely insufficient (no principal / term / rate) — then
 * the documents fall back to their guard paragraph.
 */
export function scheduleForCase(c: CaseDocData): DocSchedule | null {
  const line = c.creditLine;
  const t = line?.tranches?.[0];

  // Honor a persisted schedule if one exists (authoritative over a live recompute).
  const persisted = t?.schedule;
  if (persisted?.installments?.length) {
    return {
      principal: Number(persisted.principal),
      termMonths: persisted.termMonths,
      annualRate: Number(persisted.annualRate),
      disbursementDate: persisted.disbursementDate,
      method: persisted.method === 'DIFFERENTIATED' ? 'DIFFERENTIATED' : 'ANNUITY',
      installments: [...persisted.installments]
        .sort((a, b) => a.seq - b.seq)
        .map((i) => ({
          seq: i.seq,
          dueDate: i.dueDate,
          openingBalance: Number(i.openingBalance),
          principal: Number(i.principal),
          interest: Number(i.interest),
          total: Number(i.total),
          days: i.days,
        })),
    };
  }

  /*
    Refuse to print a schedule the tranche cannot support.

    «заявку на 110 млн открывали… график 1,100,000 млнга корсатвоти» — the line was opened for
    110 000 000 and the tranche carried 1 100 000, a hundredth of it, so the contract stated one sum
    and Илова №1 amortised another. The document was internally consistent and wrong, and it was
    signed that way.

    The test is not «the two fields differ» — they legitimately do. A 150M line drawn 60M at a time
    is an ordinary multi-tranche case: §1.1 states the ceiling, the schedule states the draw. What is
    refused is a tranche that is a clean power of ten off the line, which is a mistyped zero and
    never a drawdown. The same rule the save path applies, from the same function, so a row already
    in the database is caught at print time even though it was written before the guard existed.

    Returning null puts the document on its existing «Тўлов жадвали ҳисобланмаган» path, and the
    Excel export degrades the same way. Refusing is right: there is no way to tell which of the two
    numbers the operator meant, and inventing one would sign a client up to it.
  */
  if (t?.principal != null && line?.amountTotal != null) {
    if (trancheAmountViolations(Number(line.amountTotal), [Number(t.principal)]).length) return null;
  }

  const principal = t?.principal != null ? Number(t.principal)
    : line?.amountTotal != null ? Number(line.amountTotal)
    : c.amount != null ? Number(c.amount)
    : null;
  const termMonths = t?.termMonths ?? line?.termMonths ?? c.termMonths ?? null;
  const annualRate = line?.interestRate != null ? Number(line.interestRate) : null;
  if (!principal || principal <= 0 || !termMonths || termMonths <= 0 || annualRate == null || annualRate < 0) {
    return null;
  }

  const method: DocSchedule['method'] = t?.scheduleType === 'DIFFERENTIATED' ? 'DIFFERENTIATED' : 'ANNUITY';
  const disbursementDate = t?.contractDate ?? t?.applicationDate ?? line?.lineDate ?? c.createdAt ?? new Date();
  /*
    The fallback caps at the 15th, as the stored value does.

    `paymentDay` is written by `paymentDayFor`, which caps the formalization day — a client
    formalized on the 20th pays on the 15th. When the tranche carries no application date that
    column is null, and this line used the raw day-of-month, so a case drawn on the 20th quietly
    got a schedule paying on the 20th. Nothing failed; the document just disagreed with the rule.
    BR-2026-0002 has exactly that null.
  */
  const payDay = t?.paymentDay ?? paymentDayFor(new Date(disbursementDate).toISOString()) ?? 1;
  const monthlyRate = annualRate / 12;
  const annuity = pmt(monthlyRate, termMonths, principal);
  const flatPrincipal = principal / termMonths;

  /*
    The rows are the workbook's, formula for formula — «График N мес», identical in every reference
    file, TRUST and APEX alike:

      F (interest)   = C × I3 / 365 × (Bₙ − Bₙ₋₁)      balance × annual rate ÷ 365 × ACTUAL days
      D (principal)  row 1  PPMT(I3/12, 1, I2, −C8)     = annuity − P × rate/12
                     rows 2..n−1  I6 − F                 the annuity less that row's interest
                     row n  = C                          whatever is left, which closes the schedule
      G (total)      row 1  D + F                        not rounded
                     rows 2..n  CEILING(D + F, 1000)     rounded UP to the nearest 1000

    We had interest at balance × rate/12 — equal months, no day count — and no rounding. The monthly
    payment came out identical either way, because both derive it from the same PMT, so nothing
    looked wrong. What differed was the split printed in the «асосий қарз» and «фоизлар» columns,
    which is what the client reads, and the total: rounding up to 1000 costs about 710 so'm a month.

    Row 1 is genuinely different in the sheet and not a slip: its interest runs from the DISBURSEMENT
    date to the first payment, which is rarely a whole month, while its principal comes from PPMT at
    the monthly rate. Its total is left unrounded.

    The last row repays the remaining balance outright. That is what keeps the day-count interest
    from accumulating into a residue — without it the schedule ends 527 530 so'm past zero on a
    150M/24-month line.
  */
  const installments: DocInstallment[] = [];
  let balance = principal;
  let prevDate = new Date(disbursementDate);
  for (let m = 1; m <= termMonths; m++) {
    const dueDate = addMonthsClamped(disbursementDate, m, payDay);
    const days = daysBetween(dueDate, prevDate);
    const openingBalance = balance;
    const interest = openingBalance * annualRate / 365 * days;

    let principalPortion: number;
    if (m === termMonths) principalPortion = openingBalance;
    else if (method === 'DIFFERENTIATED') principalPortion = flatPrincipal;
    else if (m === 1) principalPortion = annuity - openingBalance * monthlyRate;
    else principalPortion = annuity - interest;
    principalPortion = Math.min(Math.max(principalPortion, 0), openingBalance);

    const raw = principalPortion + interest;
    const total = m === 1 ? raw : Math.ceil(raw / 1000) * 1000;

    balance = Math.max(0, openingBalance - principalPortion);
    installments.push({ seq: m, dueDate, openingBalance, principal: principalPortion, interest, total, days });
    prevDate = dueDate;
  }

  return { principal, termMonths, annualRate, disbursementDate: new Date(disbursementDate), method, installments };
}
