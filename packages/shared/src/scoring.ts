/**
 * Скоринг балл — the 20-factor credit score, transcribed from the reference workbook's «балл»
 * sheet (ХОВЛИ/КВАРТИРА/АВТО мфл TRUST) and its «Score отчет» verdict rule.
 *
 * Nothing computed a score before this: the ScoringResult table and the report template existed,
 * but no code ever filled them, so every case printed «Скоринг ҳисобланмаган».
 *
 * The bands below are the sheet's own IF-chains, kept literally rather than tidied. Two of them
 * look wrong and are reproduced anyway, because the point is to agree with the workbook the office
 * checks against — see FAMILY_SIZE and EXPERIENCE.
 */

/** Maximum attainable — the sheet's E5:E24 column sums to this. */
export const SCORE_MAX = 100;
/** Below this the case is refused outright; at or above APPROVE it is «Маъқулланди». */
export const SCORE_MIN = 60;
export const SCORE_APPROVE = 70;

export type ScoreVerdict =
  | 'APPROVED'            // Маъқулланди
  | 'REFER_COMMITTEE'     // Андеррайтер/Кредит қўмитаси қарорига хавола
  | 'BELOW_MIN'           // Скоринг балл минимал талабдан паст
  | 'FAILED_PROBLEM_LOANS'; // Муаммоли кредитлар мавжудлиги босқичидан ўтмади

export interface ScoreInput {
  gender?: 'MALE' | 'FEMALE' | null;
  birthDate?: Date | string | null;
  /** b3!D41 — «бир нечта олий» | «Олий» | «урта махсус» | anything else. */
  education?: string | null;
  /** Д1!C32 — matched against the sheet's three options; anything else scores 2. */
  maritalStatus?: string | null;
  /**
   * Д2!B42 «Вид имущество» — true when the pledge is a vehicle.
   *
   * The sheet holds one answer for the whole case, so with several collaterals this is the PRIMARY
   * (first) one's type, not "any of them". Downgrading a property-backed loan to the vehicle score
   * because a car was added alongside would punish extra security.
   */
  hasAutoCollateral?: boolean;
  /** b3!D22 — «Оила аъзолари сони», the family size (see FAMILY_SIZE note). */
  familySize?: number | null;
  /**
   * Д2!B28 «Залогодатель собственник?» — the pledgor owns what they pledged.
   *
   * One answer per case on the sheet, so likewise taken from the primary collateral. It is a
   * recovery question, not an affordability one: property pledged by a third party is slower and
   * less certain to enforce than the borrower's own.
   */
  pledgorIsBorrower?: boolean;
  /** b3!D15 — «яшаш давомийлиги». */
  residenceBand?: string | null;
  /** b3!F25 — the activity sector's risk code, 1..17. */
  sectorRiskCode?: number | null;
  /** b3!D26 — «Лавозими». */
  position?: string | null;
  /** b3!D27 — «мехнат давомийлиги». */
  experienceBand?: string | null;
  /** b3!D42 — «Яшаш жойи тури». */
  housingType?: string | null;
  /** b3!D43 — «Банкларда омонат хисобракамлари». */
  depositBand?: string | null;
  /** b4!C3 — «Количество имеющихся кредитов». */
  activeLoansCount?: number | null;
  /** b4!C4 — «Наличие просроченных кредитов» (0 = none). */
  overdueSubstandardFlag?: number | null;
  /** b4!C5 — «Прочие обязательства» (0 = none). */
  otherObligations?: number | null;
  /** b4!C6 — «Мавжуд» when the client has loans over 5M. */
  loansOver5MFlag?: string | null;
  /** b4!C7 — «Мавжуд» when the client borrowed from an MFI/pawnshop before. */
  priorMfiPawnshopFlag?: string | null;
  /** How many collaterals are attached — 0 means the pledge factors have nothing to read. */
  collateralCount?: number | null;

  /** балл!C27 — monthly tranche payments: existing avg payment + this loan's payment. */
  monthlyTranchePayment?: number | null;
  /** балл!C28 — Д1!C44 + C45, the two income lines. */
  monthlyIncome?: number | null;
  /** балл!C29's tail — SUM(Д1!C46:C49), the declared expenses added to the 50% base. */
  declaredExpenses?: number | null;
}

export interface ScoreFactor {
  /** Row number on the «балл» sheet, so a disputed score can be traced back to it. */
  no: number;
  key: string;
  /** The sheet's own row label, verbatim — including its lower-case «залог» and its «Залогадетель». */
  label: string;
  points: number;
  max: number;
  /**
   * The input this factor needs was not entered.
   *
   * Worth distinguishing from a scored zero: one means the client genuinely earns nothing here,
   * the other means nobody has filled the field yet. Shown differently, and counted, so a low
   * score on a half-entered case reads as "unfinished" rather than "rejected".
   */
  missing: boolean;
}

export interface ScoreResult {
  factors: ScoreFactor[];
  total: number;
  max: number;
  verdict: ScoreVerdict;
  /** How many of the twenty factors are waiting on data. */
  missingCount: number;
  /** Intermediate values the report prints (балл!C23, C24, C27..C31). */
  ratios: {
    age: number | null;
    tranchePerIncome: number | null;
    surplusPerTranche: number | null;
    income: number;
    expenses: number;
    surplus: number;
    /** балл!C27 — the monthly tranche load (this loan's payment plus what is already being paid). */
    tranche: number;
    /** балл!C31 — income minus the monthly tranche load; the sheet's income-sufficiency gate. */
    incomeMinusTranche: number;
  };
}

/** Case-insensitive, whitespace-tolerant match — the option strings are typed by hand. */
const eq = (a: string | null | undefined, b: string): boolean =>
  (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

const has = (a: string | null | undefined, needle: string): boolean =>
  (a ?? '').trim().toLowerCase().includes(needle.toLowerCase());

/** Whole years between `from` and now, as the sheet's (TODAY()-birth)/365. */
export function ageYears(birth: Date | string | null | undefined, now = new Date()): number | null {
  if (!birth) return null;
  const d = birth instanceof Date ? birth : new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  return (now.getTime() - d.getTime()) / (365 * 24 * 3600 * 1000);
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/**
 * The score, factor by factor.
 *
 * Missing inputs score 0 rather than throwing — an unfinished case still produces a report, and
 * the zeroes show exactly which sections are unfilled.
 */
export function scoreCase(i: ScoreInput): ScoreResult {
  const f: ScoreFactor[] = [];
  const blank = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && !v.trim());

  /*
    A factor with no input scores 0 — the one place this deliberately departs from the workbook.

    Excel's IF chains fall through to their else-branch on an empty cell, so a blank «Оила аъзолари
    сони» scores the full 3 there, and an empty sheet totals 31 out of nothing. On paper that never
    shows: the operator fills the sheet before reading the number. Here a case is scored while it is
    still half-entered, and awarding marks for absent data made an unfinished application look
    creditworthy — «kiritilmagan  3 / 3» side by side.

    Parity with the reference is untouched: it only differs where the workbook has no answer either,
    and the worked example fills every field.
  */
  const add = (no: number, key: string, label: string, points: number, max: number, missing = false) =>
    f.push({ no, key, label, points: missing ? 0 : points, max, missing });

  // 1. Пол — IF(Д1!C10="женщина",2,1)
  add(1, 'gender', 'Пол', i.gender === 'FEMALE' ? 2 : 1, 2, blank(i.gender));

  // 2. Возраст — IF(>68,0,IF(>=50,5,IF(>=30,4,IF(>=20,2,0))))
  const age = ageYears(i.birthDate);
  const agePts = age == null ? 0 : age > 68 ? 0 : age >= 50 ? 5 : age >= 30 ? 4 : age >= 20 ? 2 : 0;
  add(2, 'age', 'Возраст', agePts, 5, age == null);

  // 3. Образование — «бир нечта олий»→3, «Олий»→2, «урта махсус»→1, else 0.
  //    Note "олий" is a substring of "бир нечта олий", so the multi-degree option is tested first.
  const edu = has(i.education, 'бир нечта') ? 3 : eq(i.education, 'олий') ? 2 : has(i.education, 'урта махсус') ? 1 : 0;
  add(3, 'education', 'Образование', edu, 3, blank(i.education));

  /*
    4. Семейное положение — Д1!C32 against E32/F32/G32, which read «турмуш курган», «ажрашган»
    and «бўйдоқ»; anything else (a widow, say) scores 2.

    This matched «уйланган» and a half-Latin «турмуш qurgan» — neither of which the picker offers.
    A married applicant therefore fell through to the else branch and lost a point, on every case.
  */
  const ms = i.maritalStatus;
  const msPts = has(ms, 'турмуш курган') ? 3
    : has(ms, 'ажрашган') ? 2
      : has(ms, 'бўйдоқ') ? 0
        : 2;
  add(4, 'maritalStatus', 'Семейное положение', msPts, 3, blank(ms));

  // 5. Залог — IF(Д2!B42="авто",2,4)
  add(5, 'collateral', 'залог', i.hasAutoCollateral ? 2 : 4, 4, (i.collateralCount ?? 0) === 0);

  /*
    6. FAMILY_SIZE — the «балл» row is labelled «Количество детей», but its formula reads b3!D22,
    which that sheet labels «Оила аъзолари сони» (family size). The formula wins: matching the
    workbook's number matters more than its own mislabelled row.
  */
  const fam = num(i.familySize);
  const famPts = fam == null ? 3 : fam >= 3 ? 1 : fam >= 1 ? 2 : 3;
  add(6, 'familySize', 'Количество детей (оила аъзолари сони)', famPts, 3, fam == null);

  // 7. Залогодатель — IF(Д2!B28="да",3,1)
  add(7, 'pledgor', 'Залогадетель', i.pledgorIsBorrower ? 3 : 1, 3, (i.collateralCount ?? 0) === 0);

  // 8. Срок проживания — «иное»→3, «1-5 лет»→2, else 1.
  const resPts = has(i.residenceBand, 'иное') || has(i.residenceBand, 'бошқа') ? 3
    : has(i.residenceBand, '1-5') ? 2 : 1;
  add(8, 'residence', 'Срок проживания', resPts, 3, blank(i.residenceBand));

  // 9. Сфера деятельности — IF(risk>18,4,IF(risk>9,5,6)). Codes run 1..17, so >18 never fires
  //    with a valid sector; kept literally.
  const risk = num(i.sectorRiskCode);
  const riskPts = risk == null ? 0 : risk > 18 ? 4 : risk > 9 ? 5 : 6;
  add(9, 'sector', 'Сфера деятельности', riskPts, 6, risk == null);

  // 10. Должность — b3!D26 against F26/G26: «Рахбарият»→5, «ўрта менежер»→4; «мутахассис» and
  //     «хизмат кўрсатувчи» fall to the else branch at 2.
  const posPts = has(i.position, 'рахбар') ? 5 : has(i.position, 'менежер') ? 4 : i.position ? 2 : 0;
  add(10, 'position', 'Должность', posPts, 5, blank(i.position));

  /*
    11. EXPERIENCE — IF(D27=H27,5,IF(D27=G27,3,1)) where H27="3-5 лет" and G27="5-9 лет". So the
    sheet awards 5 for 3-5 years, 3 for 5-9, and 1 for everything else — including "10 и более",
    which scores lowest. That is almost certainly not intended, and is reproduced anyway.
  */
  const expPts = has(i.experienceBand, '3-5') ? 5 : has(i.experienceBand, '5-9') ? 3 : i.experienceBand ? 1 : 0;
  add(11, 'experience', 'Общий стаж', expPts, 5, blank(i.experienceBand));

  // 12. Наличие дома — «Иш берувчи томонидан»→1, «мулкий хукук»→2, else 0.
  const houPts = has(i.housingType, 'иш берувчи') ? 1 : has(i.housingType, 'мулкий') ? 2 : 0;
  add(12, 'housing', 'Наличие дома', houPts, 2, blank(i.housingType));

  /*
    13. Наличие депозитов — banded by the LOWER bound of the range, which is the only reading that
    handles both wordings in use: the sheet's «500 дан 1000$ гача экв.» and the wizard's «500-1000$».
    Matching on substrings alone cannot ("500-1000$" contains both 500 and 1000).

    «500$ кам» — under 500 — scores 0 like «мавжуд эмас»: the sheet gives points only from the
    500-1000 band up.
  */
  const dep = (i.depositBand ?? '').toLowerCase();
  const bounds = (dep.match(/\d+/g) ?? []).map(Number);
  const low = bounds.length ? Math.min(...bounds) : null;
  const belowLowest = has(dep, 'кам') || has(dep, 'менее');
  const depPts = !low || belowLowest ? 0 : low >= 3000 ? 3 : low >= 1000 ? 2 : low >= 500 ? 1 : 0;
  add(13, 'deposits', 'Наличие депозитов', depPts, 3, blank(i.depositBand));

  /*
    14. IF(C3>=3,3,IF(C3=2,2,1)). The row is labelled «погаш.» (repaid) but reads b4!C3, which that
    sheet labels «Количество имеющихся кредитов» (existing). The formula is followed, and the label
    is left as the sheet writes it — the operator matches these rows against the paper form, so
    renaming one to be clearer would make it harder to find, not easier.
  */
  const act = num(i.activeLoansCount);
  const actPts = act == null ? 1 : act >= 3 ? 3 : act === 2 ? 2 : 1;
  add(14, 'loanCount', 'Колич.погаш.кредитов', actPts, 3, act == null);

  // 15. Прочие обязательства — IF(C5=0,2,0)
  const oth = num(i.otherObligations);
  add(15, 'otherObligations', 'Прочие обязательства', oth === 0 ? 2 : 0, 2, oth == null);

  // 16. Текущие обязательства — overdue kills it; otherwise fewer existing loans scores higher.
  const ovd = num(i.overdueSubstandardFlag);
  const curPts = ovd === 1 ? 0 : act === 0 ? 5 : act === 1 ? 4 : act === 2 ? 2 : 0;
  add(16, 'currentObligations', 'Текущие обязательства', curPts, 5, ovd == null || act == null);

  // 17-18. Penalties: −5 each, max 0. «Мавжуд эмас» (none) is the clean answer.
  const over5 = has(i.loansOver5MFlag, 'мавжуд') && !has(i.loansOver5MFlag, 'эмас') ? -5 : 0;
  add(17, 'loansOver5M', 'Наличие кредитов свыше 5 млн. сум', over5, 0, blank(i.loansOver5MFlag));
  const mfi = has(i.priorMfiPawnshopFlag, 'мавжуд') && !has(i.priorMfiPawnshopFlag, 'эмас') ? -5 : 0;
  add(18, 'priorMfi', 'Получал ли кредит в МКО/ломбардах ранее', mfi, 0, blank(i.priorMfiPawnshopFlag));

  // 19-20. The affordability pair — 43 of the 100 points.
  const income = num(i.monthlyIncome) ?? 0;
  const tranche = num(i.monthlyTranchePayment) ?? 0;
  // балл!C29 — half the income is assumed as living cost, plus the declared expense lines.
  const expenses = income * 0.5 + (num(i.declaredExpenses) ?? 0);
  const surplus = income - expenses;

  const tranchePerIncome = income > 0 ? tranche / income : null;
  add(19, 'trancheToIncome', 'Транш/доход', tranchePerIncome != null && tranchePerIncome <= 0.5 ? 22 : 0, 22, income <= 0 || tranche <= 0);

  // IF(C24>=1,21,IF(C24<=1,16,0)) — the second branch is unreachable except at exactly 1.
  const surplusPerTranche = tranche > 0 ? surplus / tranche : null;
  add(20, 'surplusToTranche', '(Доход - расход)/транш', surplusPerTranche != null && surplusPerTranche >= 1 ? 21 : 16, 21, income <= 0 || tranche <= 0);

  const total = f.reduce((s, x) => s + x.points, 0);

  return {
    factors: f,
    total,
    max: SCORE_MAX,
    verdict: verdictFor(total, ovd, age),
    missingCount: f.filter((x) => x.missing).length,
    ratios: { age, tranchePerIncome, surplusPerTranche, income, expenses, surplus, tranche, incomeMinusTranche: income - tranche },
  };
}

/** Outside this range the case goes to the committee whatever it scored («Ёшга мувофиқлиги»). */
export const AGE_MIN = 18;
export const AGE_MAX = 68;

/**
 * «Score отчет»!B24 — the verdict, reproduced as the sheet computes it.
 *
 *   IF(B23<60, below-min,
 *    IF(B20=H20, problem-loans,      ← never true
 *     IF(B21=G21, committee,          ← never true
 *      IF(B22=G22, committee,         ← age outside 18..68
 *       IF(B23>=70, approved, committee)))))
 *
 * The two middle branches cannot fire: each compares a cell against a label from the wrong row
 * (B20 holds row-21 wording and is tested against row 20; B21 holds row-22 wording and is tested
 * against row 21). They are followed anyway, on instruction, so the score agrees with the workbook
 * the office computes by hand.
 *
 * The consequence is worth stating plainly: a case carrying overdue loans can still come out
 * «Маъқулланди» here, exactly as it does in the sheet. It is not hidden — the report's own
 * «Муаммоли кредитлар» row reads B20 directly and still shows the problem; only the headline
 * verdict ignores it. `FAILED_PROBLEM_LOANS` therefore never arises from a computed score, and
 * remains only for a stored ScoringResult that carries it.
 */
export function verdictFor(
  total: number,
  _overdueFlag: number | null | undefined,
  age?: number | null,
): ScoreVerdict {
  if (total < SCORE_MIN) return 'BELOW_MIN';
  if (age != null && (age > AGE_MAX || age < AGE_MIN)) return 'REFER_COMMITTEE';
  if (total >= SCORE_APPROVE) return 'APPROVED';
  return 'REFER_COMMITTEE';
}

/** The sheet's own wording for each verdict. */
export const SCORE_VERDICT_LABEL: Record<ScoreVerdict, string> = {
  APPROVED: 'Маъқулланди',
  REFER_COMMITTEE: 'Андеррайтер/Кредит қўмитаси қарорига хавола',
  BELOW_MIN: 'Скоринг балл минимал талабдан паст',
  FAILED_PROBLEM_LOANS: 'Муаммоли кредитлар мавжудлиги босқичидан ўтмади',
};

/* ── Mapping a case onto the score ─────────────────────────────────────────── */

/**
 * The shape both the API DTO and the loaded Prisma row satisfy.
 *
 * Deliberately loose: the two differ (Decimal vs number, Date vs ISO string) and neither is worth
 * converting just to score it. One mapper means the wizard's live preview and the printed report
 * can never disagree about the number — which they would within a week if written twice.
 */
export interface ScorableCase {
  borrower?: {
    gender?: unknown; birthDate?: unknown; education?: string | null; maritalStatus?: string | null;
    familySize?: number | null; regTenure?: string | null; residenceDuration?: string | null;
    fullName?: string | null;
    ownsHome?: string | null; depositsBand?: string | null;
  } | null;
  employment?: { sectorRiskCode?: number | null; position?: string | null; experienceBand?: string | null } | null;
  affordability?: {
    mainActivityIncome?: unknown; secondaryIncome?: unknown; familyIncome?: unknown; otherIncome?: unknown;
    utilitiesExpense?: unknown;
    familyExpense?: unknown; otherExpense?: unknown; newLoanPayment?: unknown; existingCreditBurden?: unknown;
  } | null;
  creditHistory?: {
    activeLoansCount?: number | null; overdueSubstandardFlag?: number | null; otherObligations?: number | null;
    loansOver5MFlag?: string | null; priorMfiPawnshopFlag?: string | null; avgMonthlyPaymentExisting?: unknown;
  } | null;
  collaterals?: { type?: unknown; owners?: { fullName?: string | null }[] | null }[] | null;
  creditLine?: { tranche?: { monthlyPayment?: unknown } | null; tranches?: { monthlyPayment?: unknown }[] | null } | null;
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export function scoringInputFromCase(c: ScorableCase): ScoreInput {
  const b = c.borrower;
  const emp = c.employment;
  const af = c.affordability;
  const h = c.creditHistory;
  // The DTO exposes a single `tranche`; the Prisma row a `tranches` array.
  const tr = c.creditLine?.tranche ?? c.creditLine?.tranches?.[0] ?? null;
  // The case's main pledge — the same one CreditCase.productType is derived from.
  const primary = (c.collaterals ?? [])[0] ?? null;

  const newPayment = toNum(af?.newLoanPayment) ?? toNum(tr?.monthlyPayment) ?? 0;
  const existing = toNum(af?.existingCreditBurden) ?? toNum(h?.avgMonthlyPaymentExisting) ?? 0;

  return {
    gender: (b?.gender as 'MALE' | 'FEMALE' | null) ?? null,
    birthDate: (b?.birthDate as Date | string | null) ?? null,
    education: b?.education ?? null,
    maritalStatus: b?.maritalStatus ?? null,
    /*
      Both pledge factors read the PRIMARY collateral, because the sheet has one cell for each and
      no notion of a second pledge. Taking the worst of several instead would mean a house-backed
      loan scored as a car loan the moment a vehicle was added as extra cover.
    */
    hasAutoCollateral: primary?.type === 'AUTO',
    collateralCount: (c.collaterals ?? []).length,
    familySize: b?.familySize ?? null,
    // «да» when the borrower pledges their own. An empty owner list means exactly that — the
    // borrower stands in (see resolveOwners) — so it counts as yes.
    pledgorIsBorrower: !primary?.owners?.length
      || primary.owners.some((o) => o.fullName === b?.fullName),
    /*
      Two columns hold the same answer: the wizard writes `residenceDuration`, while the anketa and
      this factor read `regTenure`. Reading only the latter meant «Срок проживания» scored 0 on
      every case the wizard produced. Both are read until the duplicate is retired.
    */
    /*
      Eight factors are fed by questions the operator form no longer asks (owner's call,
      2026-07-29). Left null they score zero, and zero reads as the worst grade rather than as
      «unknown» — the same applicant fell from 95 to 64 and from APPROVED to REFER_COMMITTEE with
      nothing about them changed.

      Two of the eight get a fallback, and only those two. «Должность» and «Общий стаж» describe
      work the borrower plainly does; the mid grade is what the workbook yields for those rows left
      blank, and neither one is a claim about the borrower's record.

      The other six do not, and the reasons are worth keeping:

        · «Муаммоли кредитлар» (overdueSubstandardFlag) — measured: a default here carries a case
          over the 70 line (67 → 72), so a report would print «маълумот тўлдирилмаган» beside
          «Маъқулланди». An unknown arrears record must not read as a clean one.
        · «5 млн+ кредит» / «МКО-ломбард» — worth zero points either way, so a default buys nothing
          and turns «not asked» into an unverified assertion that the borrower has neither.
        · «Прочие обязательства» — the reference books carry an explicit 0 there, so parity already
          holds; a fallback would only ever fire when nobody entered anything, and it pays a point.
        · «Сфера деятельности» — a null risk code is also what «Boshqa» produces, and this codebase
          already settles that: an activity we were not told is not rated (sector-other.spec).
        · «Срок проживания» — the value the picker offers is not one the workbook grades.

      So the score no longer reads a blank as the worst answer, and it still never invents one about
      the borrower's credit record. The factor list stays the workbook's twenty, and the documents
      read the case itself, so an unasked question prints as «—».
    */
    residenceBand: b?.regTenure ?? b?.residenceDuration ?? null,
    sectorRiskCode: emp?.sectorRiskCode ?? null,
    position: emp?.position ?? 'мутахассис',
    experienceBand: emp?.experienceBand ?? 'до 3 лет',
    housingType: b?.ownsHome ?? null,
    depositBand: b?.depositsBand ?? null,
    activeLoansCount: h?.activeLoansCount ?? null,
    overdueSubstandardFlag: h?.overdueSubstandardFlag ?? null,
    otherObligations: h?.otherObligations ?? null,
    loansOver5MFlag: h?.loansOver5MFlag ?? null,
    priorMfiPawnshopFlag: h?.priorMfiPawnshopFlag ?? null,
    monthlyTranchePayment: newPayment + existing,
    /*
      балл!C28 reads Д1!C44+C45, and b3 splits those same two into its four income lines — D28←C44,
      D31←C45, the other two unlinked. Summing all four instead is both the sheet's own total
      (b3!D38 = SUM(D28:D31), what its debt-burden ratio divides by) and identical to C44+C45 on the
      reference, where the unlinked pair is empty. Reading only two of the four would have silently
      dropped a client's secondary or family income from the affordability factors — 43 of the 100.
    */
    monthlyIncome:
      (toNum(af?.mainActivityIncome) ?? 0) + (toNum(af?.secondaryIncome) ?? 0)
      + (toNum(af?.familyIncome) ?? 0) + (toNum(af?.otherIncome) ?? 0),
    /*
      балл!C29 = C28×0.5 + SUM(Д1!C46:C49), and that range is utilities, family, EXISTING CREDIT
      PAYMENTS (C48 ← b4!C9) and other. The credit line was missing here, so anyone already
      servicing debt showed a larger surplus than the sheet gives them.

      It is deliberately counted twice — once as an expense, once inside the tranche load — because
      that is what C27 and C29 do.
    */
    declaredExpenses:
      (toNum(af?.utilitiesExpense) ?? 0) + (toNum(af?.familyExpense) ?? 0)
      + (toNum(af?.otherExpense) ?? 0) + existing,
  };
}

/** Score a case straight from either shape. */
export function scoreForCase(c: ScorableCase): ScoreResult {
  return scoreCase(scoringInputFromCase(c));
}
