import { LoanType, ProductType, RepaymentMethod } from './enums';
import { pmt } from './loan';
import type { CollateralDto, CreditCaseDto } from './dto';
import { collateralOwnerErrors } from './collateral-owner';

/** Insurance partners currently on-boarded (the "Kompaniya" dropdown). */
export const INSURANCE_COMPANIES = ['TRUST INSURANCE', 'APEX INSURANCE'] as const;
/** Insured sum = ×1.3 of the policy-backed loan. The premium is a FLAT rate by TERM BRACKET
 *  (≤1 yil → 2%, over 1 yil → 4%) — NOT per-year. Max term 4 years (48 months). */
export const INSURANCE_ANNUAL_RATE = 0.02; // legacy default (kept for the toggle prefill)
export const INSURANCE_MAX_MONTHS = 48;
/**
 * Flat insurance premium rate by policy-term bracket: ≤12 oy → 2%, over 12 oy → 4%; 0 without a term.
 * The bracket moved from 24 to 12 months on 2026-07-29 (owner-set) — a two-year policy now costs 4%,
 * not 2%.
 */
export function insurancePremiumRate(months: number | null | undefined): number {
  const m = months ?? 0;
  if (m <= 0) return 0;
  if (m <= 12) return 0.02;
  return 0.04; // 12 < m ≤ 48 (UI/validation caps at 48)
}
/** Common gen-agreement number prefix that opens every policy number; the tail changes per policy. */
export const INSURANCE_GEN_PREFIX = '01/14/260004-';
/** Collateral must cover 140% of the property-backed loan portion (amountAuto). */
export const COLLATERAL_COVERAGE_TARGET = 1.4;

/** Relationship options for a borrower's close contacts (yaqin kishilar). */
export const RELATIVE_RELATIONS = ['Ota', 'Ona', 'Aka', 'Uka', 'Opa', 'Singil', 'Turmush o‘rtog‘i', 'Farzand', 'Qarindosh', 'Boshqa'] as const;

/** Over 100M (mikrokredit) the borrower's entrepreneur status + guvohnoma raqami is captured. */
export const ENTREPRENEUR_TYPES = ['Yakka tartibdagi tadbirkor', 'O‘zini o‘zi band qilgan'] as const;

/**
 * Monthly payment day-of-month, derived from the formalization (tranche application) date: the day
 * the client is formalized, capped at the 15th. Formalized on the 7th → pays on the 7th each month;
 * on the 20th → capped to the 15th. (Was an Excel rule; now system-computed.)
 */
export const PAYMENT_DAY_CAP = 15;
export function paymentDayFor(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.min(d.getUTCDate(), PAYMENT_DAY_CAP);
}

/** ≤ threshold → микроқарз, > → микрокредит. */
export const MICRO_THRESHOLD = 100_000_000;
export function loanTypeFor(amount: number | null | undefined): LoanType {
  return (amount ?? 0) > MICRO_THRESHOLD ? LoanType.MICROCREDIT : LoanType.MICROLOAN;
}

/**
 * Representative monthly payment for a tranche, from the repayment method + principal + term + annual
 * rate (fraction, e.g. 0.55 = 55%/yil). ANNUITY → the level annuity via Excel-PMT. DIFFERENTIATED →
 * the FIRST (largest) month: principal/term + interest on the full principal (later months decline).
 * Returns null when inputs are insufficient. Rounded to whole so'm.
 */
export function monthlyPaymentFor(
  method: RepaymentMethod | null | undefined,
  principal: number | null | undefined,
  termMonths: number | null | undefined,
  annualRate: number | null | undefined,
): number | null {
  if (!method || !principal || principal <= 0 || !termMonths || termMonths <= 0) return null;
  const r = (annualRate ?? 0) / 12;
  if (method === RepaymentMethod.DIFFERENTIATED) return Math.round(principal / termMonths + principal * r);
  return Math.round(pmt(r, termMonths, principal));
}

/** Max term (months) per repayment method — the TRANCHE (credit contract) repayment schedule. */
export const TERM_CAP: Record<RepaymentMethod, number> = {
  [RepaymentMethod.ANNUITY]: 30,
  [RepaymentMethod.DIFFERENTIATED]: 48,
};
/** Max РКЛ (bosh kelishuv liniyasi) duration. The line opens for up to 60 months; individual credit
 *  contracts (tranches) drawn under it run up to 48 (differential) / 30 (annuity). */
export const LINE_TERM_CAP = 60;
export function termCapFor(method: RepaymentMethod): number {
  return TERM_CAP[method] ?? TERM_CAP[RepaymentMethod.ANNUITY];
}
export function isTermValid(method: RepaymentMethod, term: number | null | undefined): boolean {
  return !!term && term > 0 && term <= termCapFor(method);
}

export interface LoanRuleInput {
  scheduleType?: RepaymentMethod | null;
  trancheTermMonths?: number | null;
  lineTermMonths?: number | null;
}

/**
 * Server-authoritative term-cap checks. Two independent caps:
 *  - the TRANCHE (credit contract) repayment schedule: annuity ≤30 / differential ≤48;
 *  - the РКЛ (bosh kelishuv liniyasi) duration: ≤60 months, regardless of schedule.
 * Empty array = valid.
 */
export function loanRuleViolations(i: LoanRuleInput): string[] {
  const errs: string[] = [];
  const m = i.scheduleType ?? undefined;
  if (m && i.trancheTermMonths != null && !isTermValid(m, i.trancheTermMonths)) {
    errs.push(`Transh muddati ${termCapFor(m)} oydan oshmasligi kerak`);
  }
  if (i.lineTermMonths != null && (i.lineTermMonths <= 0 || i.lineTermMonths > LINE_TERM_CAP)) {
    errs.push(`Liniya (bosh kelishuv) muddati ${LINE_TERM_CAP} oydan oshmasligi kerak`);
  }
  return errs;
}

/** A moderator may act on a case only if it sits in one of their assigned branches. */
export function isCaseInScope(branchIds: string[], caseBranchId: string | null | undefined): boolean {
  return !!caseBranchId && branchIds.includes(caseBranchId);
}

/**
 * b3!M:N — activity sphere → industry-risk code (1–17). Lower code = lower risk.
 *
 * `label` is the STORED value and the one the documents print, so it stays Russian exactly as the
 * workbook writes it — the risk code is looked up by that string, and translating it would orphan
 * every row already saved. `uz` is for display only; `search` carries English words so the picker
 * can be typed into in whichever language comes to hand.
 */
export const SECTOR_RISK: { label: string; uz: string; search: string; code: number }[] = [
  { code: 1, label: 'Безопасность / Военная служба / Служба спасения / Органы внутренних дел',
    uz: 'Xavfsizlik / Harbiy xizmat / Qutqaruv xizmati / Ichki ishlar organlari',
    search: 'security military rescue police' },
  { code: 2, label: 'Недвижимость / Эксплуатация / ЖКХ',
    uz: 'Ko‘chmas mulk / Ekspluatatsiya / Kommunal xo‘jalik',
    search: 'real estate property utilities' },
  { code: 3, label: 'Проектирование / Строительство',
    uz: 'Loyihalash / Qurilish', search: 'design construction building' },
  { code: 4, label: 'Промышленность / Производство',
    uz: 'Sanoat / Ishlab chiqarish', search: 'industry manufacturing production' },
  { code: 5, label: 'Сельское хозяйство', uz: 'Qishloq xo‘jaligi', search: 'agriculture farming' },
  { code: 6, label: 'Транспорт, Перевозка и хранение',
    uz: 'Transport, tashish va saqlash', search: 'transport logistics storage' },
  { code: 7, label: 'Фармацевтика / Медицина / Ветеринария',
    uz: 'Farmatsevtika / Tibbiyot / Veterinariya', search: 'pharmacy medicine health veterinary' },
  { code: 8, label: 'Фитнес / Физкультура / Спорт',
    uz: 'Fitnes / Jismoniy tarbiya / Sport', search: 'fitness sport' },
  { code: 9, label: 'Бухгалтерия / Банки / Страхование / Финансы / Инвестиции',
    uz: 'Buxgalteriya / Banklar / Sug‘urta / Moliya / Investitsiyalar',
    search: 'accounting bank insurance finance investment' },
  { code: 10, label: 'Бытовые услуги / Сервисные центры / Автосервис',
    uz: 'Maishiy xizmatlar / Servis markazlari / Avtoservis',
    search: 'household services car service repair' },
  { code: 11, label: 'Телекоммуникации / Связь / Информационные технологии',
    uz: 'Telekommunikatsiya / Aloqa / Axborot texnologiyalari',
    search: 'telecom communication it information technology' },
  { code: 12, label: 'Юриспруденция', uz: 'Yuridik soha', search: 'law legal juridical' },
  { code: 13, label: 'Торговля / Продажи', uz: 'Savdo / Sotuv', search: 'trade sales retail' },
  { code: 14, label: 'Государственная служба', uz: 'Davlat xizmati', search: 'government public service' },
  { code: 15, label: 'Маркетинг / Реклама / PR / GR',
    uz: 'Marketing / Reklama / PR / GR', search: 'marketing advertising pr gr' },
  { code: 16, label: 'Наука / Культура / Искусство',
    uz: 'Fan / Madaniyat / San‘at', search: 'science culture art' },
  { code: 17, label: 'Образование / Бизнес-образование / Консалтинг',
    uz: 'Ta‘lim / Biznes-ta‘lim / Konsalting', search: 'education training consulting' },
];

export const SECTOR_OTHER = 'Boshqa';
/** Shown instead of the stored «Boshqa» when the interface is in Russian. */
export const SECTOR_OTHER_RU = 'Другое';

/** Risk code 1..17, or null for «Boshqa» and anything unrecognised — those score nothing. */
export function sectorRiskCode(label: string | null | undefined): number | null {
  return SECTOR_RISK.find((s) => s.label === label)?.code ?? null;
}

export interface OriginationCalcInput {
  mainActivityIncome?: number | null;
  secondaryIncome?: number | null;
  familyIncome?: number | null;
  otherIncome?: number | null;
  utilitiesExpense?: number | null;
  familyExpense?: number | null;
  otherExpense?: number | null;
  existingCreditBurden?: number | null; // b4 avg monthly payment on existing loans
  newLoanPayment?: number | null;       // tranche monthly payment
  loanUnderPolicy?: number | null;
  insuranceRate?: number | null;        // fraction, e.g. 0.02
  policyTermMonths?: number | null;
  amountTotal?: number | null;
  collateralTotal?: number | null;
  requiredInsuredAmount?: number | null; // manual override of the ×1.3 insured sum
}

export interface OriginationCalc {
  totalIncome: number;
  totalCreditPayments: number; // existing + new
  totalExpenses: number;       // utilities + family + other + existing + new payment
  dtiRatio: number;            // totalCreditPayments / totalIncome (0 when no income)
  surplus: number;             // totalIncome − totalExpenses
  minRequiredIncome: number;   // ROUNDUP((existing + new) × 2.2, −3)
  insuredSum: number;          // loanUnderPolicy × 1.3
  premium: number;             // insuredSum × flat bracket rate (≤2yil 2% / 2–4yil 4%)
  coverageRatio: number;       // collateralTotal / amountTotal (0 when no amount)
  affordabilityOk: boolean;    // surplus ≥ 0 && totalIncome ≥ minRequiredIncome
}

const n = (v: number | null | undefined): number => v ?? 0;
const roundUpTo = (x: number, unit: number): number => Math.ceil(x / unit) * unit;

export function originationCalc(i: OriginationCalcInput): OriginationCalc {
  const totalIncome = n(i.mainActivityIncome) + n(i.secondaryIncome) + n(i.familyIncome) + n(i.otherIncome);
  const totalCreditPayments = n(i.existingCreditBurden) + n(i.newLoanPayment);
  const totalExpenses = n(i.utilitiesExpense) + n(i.familyExpense) + n(i.otherExpense) + totalCreditPayments;
  const dtiRatio = totalIncome > 0 ? totalCreditPayments / totalIncome : 0;
  const surplus = totalIncome - totalExpenses;
  const minRequiredIncome = roundUpTo((n(i.existingCreditBurden) + n(i.newLoanPayment)) * 2.2, 1000);
  const insuredSum = i.requiredInsuredAmount ?? roundUpTo(n(i.loanUnderPolicy) * 1.3, 1); // override ?? ×1.3
  // Flat premium by term bracket (≤2 yil → 2%, 2–4 yil → 4%) of the effective insured sum.
  const premium = roundUpTo(insuredSum * insurancePremiumRate(i.policyTermMonths), 1);
  const coverageRatio = i.amountTotal ? n(i.collateralTotal) / n(i.amountTotal) : 0;
  const affordabilityOk = totalIncome > 0 && surplus >= 0 && totalIncome >= minRequiredIncome;
  return { totalIncome, totalCreditPayments, totalExpenses, dtiRatio, surplus, minRequiredIncome, insuredSum, premium, coverageRatio, affordabilityOk };
}

export interface PersistedInput {
  amountTotal?: number | null;
  loanUnderPolicy?: number | null;
  insuranceRate?: number | null;
  policyTermMonths?: number | null;
  requiredInsuredAmount?: number | null;
  trancheMonthlyPayment?: number | null;
}
export interface PersistedDerived {
  loanType: LoanType;
  amount: number | null;
  insuredSum: number;
  premium: number;
  newLoanPayment: number | null;
}

/** Server-authoritative derived values to write to the DB columns documents read. */
export function originationPersistedValues(i: PersistedInput): PersistedDerived {
  const calc = originationCalc({
    loanUnderPolicy: i.loanUnderPolicy,
    insuranceRate: i.insuranceRate,
    policyTermMonths: i.policyTermMonths,
    requiredInsuredAmount: i.requiredInsuredAmount,
  });
  return {
    loanType: loanTypeFor(i.amountTotal),
    amount: i.amountTotal ?? null,
    insuredSum: calc.insuredSum,
    premium: calc.premium,
    newLoanPayment: i.trancheMonthlyPayment ?? null,
  };
}

/** The collateral fields the Garov step gates on (per type). realtyKind is intentionally excluded
 *  — it always defaults to APARTMENT, so requiring it could never fail. */
export type CollateralField = 'agreedValue' | 'address' | 'cadastreNo' | 'model' | 'stateNumber' | 'techPassportNo';

/** Missing required fields for one collateral, as {field, Uz label}. Single source of truth for
 *  both the wizard submit gate and the per-collateral tab colour. */
export function collateralMissing(c: CollateralDto, purchase = false): { field: CollateralField; label: string }[] {
  const out: { field: CollateralField; label: string }[] = [];
  const need = (ok: boolean, field: CollateralField, label: string) => { if (!ok) out.push({ field, label }); };
  need((c.agreedValue ?? 0) > 0, 'agreedValue', 'Kelishilgan qiymat');
  if (c.type === ProductType.AUTO) {
    need(!!c.model?.trim(), 'model', 'Model');
    // A newly purchased car has no plate / tech passport yet — required only for an existing pledge.
    if (!purchase) {
      need(!!c.stateNumber?.trim(), 'stateNumber', 'Davlat raqami');
      need(!!c.techPassportNo?.trim(), 'techPassportNo', 'Tex passport №');
    }
  } else {
    need(!!c.address?.trim(), 'address', 'Manzil');
    // A new build (from a developer) may not have a cadastre yet.
    if (!purchase) need(!!c.cadastreNo?.trim(), 'cadastreNo', 'Kadastr №');
  }
  return out;
}

/** A collateral is complete when it has no missing required fields. */
export const collateralComplete = (c: CollateralDto, purchase = false): boolean => collateralMissing(c, purchase).length === 0;

/** Per-field error map for the CollateralCard (field → "<Label> majburiy"). */
export function collateralErrors(c: CollateralDto, purchase = false): Partial<Record<CollateralField, string>> {
  const out: Partial<Record<CollateralField, string>> = {};
  for (const { field, label } of collateralMissing(c, purchase)) out[field] = `${label} majburiy`;
  return out;
}

/**
 * Server-authoritative FULL required-field validation for the DRAFT → MODERATION submit gate.
 * Single source of truth mirroring the wizard's `errors` (useOriginationForm) — so a half-filled
 * draft can never reach the moderator, regardless of what the client sent. Returns the Uz messages
 * for every unsatisfied requirement (empty array = ready to submit).
 */
export function caseSubmitErrors(c: CreditCaseDto): string[] {
  const out: string[] = [];
  const b = c.borrower;

  if (!b?.fullName?.trim()) out.push('F.I.O majburiy');
  if ((b?.pinfl ?? '').length !== 14) out.push('PINFL 14 raqam bo‘lishi kerak');
  if ((b?.passportSeries ?? '').length !== 2) out.push('Pasport seriya majburiy');
  if ((b?.passportNumber ?? '').length !== 7) out.push('Pasport raqami majburiy');
  if (!b?.phone) out.push('Telefon majburiy');
  const validContacts = (b?.closeContacts ?? []).filter((cc) => cc.fullName?.trim() && cc.phone?.trim());
  if (validContacts.length < 2) out.push('Kamida 2 ta yaqin kishi majburiy');

  const line = c.creditLine;
  const amountTotal = line?.amountTotal ?? c.amount ?? null;
  if (!amountTotal || amountTotal <= 0) out.push('Jami summa majburiy');

  if (!line?.termMonths || line.termMonths <= 0 || line.termMonths > LINE_TERM_CAP) {
    out.push(`Liniya muddati majburiy (1..${LINE_TERM_CAP})`);
  }

  const isAsset = c.product === 'AVTO' || c.product === 'IPOTEKA';
  if (isAsset && !c.sellerId) out.push('Sotuvchi majburiy');
  // Registration docs (plate / tex passport / cadastre) are missing only for a NEW asset bought from
  // a firm; an existing asset from an individual owner already has them.
  const newFromFirm = isAsset && (c.seller?.kind === 'LEGAL' || c.sellerKind === 'LEGAL');
  const cs = c.collaterals;
  if (cs.length === 0) {
    out.push('Kamida 1 ta garov majburiy');
  } else {
    const i = cs.findIndex((col) => !collateralComplete(col, newFromFirm));
    if (i >= 0) out.push(`Garov ${i + 1}: ${collateralMissing(cs[i], newFromFirm).map((m) => m.label).join(', ')} majburiy`);
    // Every document names an owner. With none entered the borrower stands in, so this only fires
    // when the borrower has no name either — a case that could reach the director with «—» printed
    // where the pledgor belongs.
    out.push(...collateralOwnerErrors(cs, b));
  }

  const tr = line?.tranche;
  if (!tr?.scheduleType) out.push('Jadval turini tanlang');
  if (!isTermValid((tr?.scheduleType ?? undefined) as RepaymentMethod, tr?.termMonths)) out.push('Transh muddati noto‘g‘ri');
  if (!tr?.principal || tr.principal <= 0) out.push('Asosiy summa majburiy');

  const h = c.creditHistory;
  // Only the three KATM fields the operator form still shows are required. The other five are
  // temporarily hidden (2026-07-29, see steps.tsx «HOZIRCHA KERAK EMAS»); demanding them here
  // would refuse every submission on invisible fields. Restore when the fields come back:
  //   && h.repaidLoansCount != null && h.overdueSubstandardFlag != null
  //   && h.otherObligations != null && !!h.loansOver5MFlag && !!h.priorMfiPawnshopFlag
  const katmFilled = !!h
    && h.activeLoansCount != null
    && h.totalOutstandingDebt != null && h.avgMonthlyPaymentExisting != null;
  if (!katmFilled) out.push('KATM bo‘limi to‘liq to‘ldirilishi shart');

  if ((amountTotal ?? 0) > MICRO_THRESHOLD) {
    const employmentOk = !!c.employment?.employer?.trim() && (c.affordability?.mainActivityIncome ?? 0) > 0;
    if (!employmentOk) out.push('Mikrokredit (100 mln+) — ish joyi va asosiy daromad majburiy');
  }

  return out;
}
