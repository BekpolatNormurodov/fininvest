import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { COLLATERAL_COVERAGE_TARGET, collateralRequirementMet } from '@credit-core/shared';
import { moneyWithWordsCyr, dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { gridTable, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { wordsCyr } from './_shared';
import { scoringForCase } from '../scoring-for-case';

// The exact phrases the reference sheet offers for each gate — never invent wording.
const OK = 'Талабларга мос келади';
const NOT_OK = 'Талабларга мос келмайди';
const REFER = 'Кредит қўмитаси қарорига хавола';
const NO_HISTORY = 'Кредит тарихи маълумотлари тўлдирилмаган';

/** ХУЛОСА wording — maps the stored ScoringVerdict onto the sheet's own options. */
const VERDICT_LABEL: Record<string, string> = {
  APPROVED: 'Маъқулланди',
  REFER_COMMITTEE: 'Андеррайтер/Кредит қўмитаси қарорига хавола',
  BELOW_MIN: 'Скоринг балл минимал талабдан паст',
  FAILED_INCOME: 'ИНПС асосида даромадларни текшириш босқичидан ўтмади',
  FAILED_PROBLEM_LOANS: 'Муаммоли кредитлар мавжудлиги босқичидан ўтмади',
};

/** Label / value row; values are bold+underlined on the sheet. */
const row = (label: string, value: string, fill?: string): TableCell[] => [
  { text: label, margin: [0, 3, 0, 3], fillColor: fill },
  { text: value, bold: true, decoration: 'underline', alignment: 'center', margin: [0, 3, 0, 3], fillColor: fill },
];
/** Plain (non-underlined) value row — used for the identity block. */
const plainRow = (label: string, value: string): TableCell[] => [
  { text: label, margin: [0, 3, 0, 3] },
  { text: value, margin: [0, 3, 0, 3] },
];

const table = (body: TableCell[][]): Content => ({
  table: { widths: [230, '*'], body },
  layout: gridTable,
  margin: [0, 2, 0, 4],
});

/**
 * Score отчет — «СКОРИНГ ТАХЛИЛ НАТИЖАДАЛАРИ», matching the reference sheet: the identity/terms
 * block, then the six scoring gates each carrying one of the sheet's standard verdict phrases, the
 * Скоринг балл, the highlighted ХУЛОСА, and the credit-manager signature. No org letterhead and no
 * factor breakdown table — the sheet has neither.
 */
export function scoreReportTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  /*
    A stored result wins if one was ever persisted; otherwise the score is computed from the case
    the same way the payment schedule is. Nothing has ever written ScoringResult, so before this
    every report printed «Скоринг ҳисобланмаган» no matter how complete the application was.
  */
  const computed = scoringForCase(c);
  const s = c.scoring ?? {
    computedAt: null,
    totalScore: computed.total,
    verdict: computed.verdict,
    age: computed.ratios.age,
    // The sheet's income gate reads балл!C31 — income minus the monthly tranche load.
    netAfterDebt: computed.ratios.incomeMinusTranche,
  };
  const history = c.creditHistory;

  const amount = line?.amountTotal ?? c.amount ?? null;
  const term = line?.termMonths ?? null;
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : null;
  /*
    The entrepreneur certificate is only collected above the microcredit threshold, so under it this
    row printed «—» even when the operator had already said what the client does. On a self-employed
    client that is the line a reader is looking for, and it was typed into «Ish joyi» — «O'Z O'ZINI
    BAND QILGAN №12588». The certificate wins where it exists; the workplace stands in where it does
    not.
  */
  const activity = [b?.entrepreneurType, b?.entrepreneurCertNo].filter(Boolean).join(' № ')
    || c.employment?.employer?.trim()
    || '—';

  const identity: Content = table([
    plainRow('МИЖОЗ Ф.И.Ш.', b?.fullName ?? '—'),
    plainRow('Манзил', b?.regAddress ?? b?.address ?? '—'),
    plainRow('Фаолият тури', activity),
    plainRow('Кредит тури', 'Микромолия линия'),
    plainRow('Микромолия линияси лимити', moneyWithWordsCyr(amount)),
    plainRow('Микромолия линияси муддати', term != null ? `${term} (${wordsCyr(term)}) ой` : '—'),
    plainRow('Фоиз ставкаси', ratePct != null ? `${ratePct}% (${wordsCyr(ratePct)}) фоиз` : '—'),
  ]);

  const header: Content[] = [
    { text: 'СКОРИНГ ТАХЛИЛ НАТИЖАДАЛАРИ', bold: true, alignment: 'center', fontSize: 12, decoration: 'underline' },
    { text: s?.computedAt ? dateToRuCyrillic(s.computedAt) : '—', margin: [0, 10, 0, 12] },
    identity,
  ];

  if (!s) {
    return {
      defaultStyle: DOC_DEFAULT_STYLE,
      pageMargins: DOC_PAGE_MARGINS,
      content: [
        ...header,
        { text: 'Скоринг ҳисобланмаган', bold: true, fontSize: 11, margin: [0, 12, 0, 0] },
        { text: 'Кредит менежери имзоси ______________', alignment: 'center', margin: [0, 30, 0, 0] },
      ],
    };
  }

  /*
    B17 and B18 are the two gates the sheet does NOT compute — it types «Талабларга мос келади»
    into both and leaves them there, so on paper they say the same thing about every case.

    A deliberate departure, confirmed with the office: a line that always passes tells the reader
    nothing, and these two are checkable. Terms pass when the loan actually has an amount, a term
    and a rate; collateral passes when the pledges cover the property-backed portion by the 140%
    the business requires. The remaining four follow their formulas exactly.
  */
  const termsOk = Number(amount ?? 0) > 0 && Number(term ?? 0) > 0 && ratePct != null;

  const collateralTotal = c.collaterals.reduce((sum, col) => sum + Number(col.agreedValue ?? 0), 0);
  const collateralBase = Number(line?.amountAuto ?? line?.amountTotal ?? amount ?? 0);
  // Product-aware: cash products need >=140% pledge coverage; asset products (AVTO/IPOTEKA) gate on
  // the down payment reaching the product minimum. Legacy no-product cases keep the coverage rule.
  const collateralOk = c.product
    ? collateralRequirementMet(c.product, {
        pledgedValue: collateralTotal,
        loanBase: collateralBase,
        downPayment: c.downPaymentPct != null ? Number(c.downPaymentPct) / 100 : undefined,
      })
    : collateralBase > 0 && collateralTotal / collateralBase >= COLLATERAL_COVERAGE_TARGET;

  /*
    B19 = IF(балл!C31<0, G22, H22) — «Даромадларнинг етарлилиги», where C31 is income minus the
    monthly tranche load. A shortfall is «Талабларга мос келмайди»; we printed «Кредит қўмитаси
    қарорига хавола», which belongs to a different row and is a softer answer than the sheet gives.
  */
  const netAfterDebtRaw = s.netAfterDebt ?? c.affordability?.netAfterDebt;
  const netAfterDebt = netAfterDebtRaw != null ? Number(netAfterDebtRaw) : null;
  const incomeVerdict = netAfterDebt == null ? NO_HISTORY : netAfterDebt >= 0 ? OK : NOT_OK;

  /*
    B20 = IF(b4!C4="", I21, IF(b4!C4=0, H21, G21)) — «Муаммоли кредитлар».

    The wording comes from row 21, not from the «Муаммоли кредитлар мавжуд/мавжуд эмас» pair in
    row 20, which that formula never reads. We were printing the row-20 strings, so this line said
    something the sheet never says.
  */
  const overdue = history?.overdueSubstandardFlag;
  const problemVerdict = history == null || overdue == null ? NO_HISTORY : overdue === 0 ? OK : REFER;

  /*
    B21 = IF(b4!C3="", I22, IF(b4!C3>=3, G22, H22)) — «Жорий мажбуриятлари».

    Three or more existing loans fails this gate. Ours passed it unconditionally whenever any
    credit history existed, so the one condition it tests never fired. (I22 is an empty cell; the
    «not filled» wording is used for that case, as B20 does with I21 — a blank line on a printed
    report reads as a fault in the form.)
  */
  const activeLoans = history?.activeLoansCount;
  const obligationsVerdict = history == null || activeLoans == null
    ? NO_HISTORY
    : activeLoans >= 3 ? NOT_OK : OK;

  const age = s.age;
  const ageOk = age != null && age >= 18 && age <= 68;

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      ...header,
      { text: 'Скоринг натижаси:', bold: true, margin: [0, 12, 0, 6] },
      table([
        row('Умумий шартларга (сумма, муддати, фоиз ставка)', termsOk ? OK : NOT_OK),
        row('Гаровга кўйилган талаблар', collateralOk ? OK : NOT_OK),
        row('Даромадларнинг етарлилиги', incomeVerdict),
        row('Муаммоли кредитлар', problemVerdict),
        row('Жорий мажбуриятлари', obligationsVerdict),
        row('Ёшга мувофиқлиги', ageOk ? OK : NOT_OK),
        [
          { text: 'Скоринг балл', bold: true, alignment: 'center', margin: [0, 3, 0, 3] },
          { text: String(s.totalScore), bold: true, alignment: 'center', margin: [0, 3, 0, 3] },
        ],
        row('ХУЛОСА', VERDICT_LABEL[String(s.verdict)] ?? String(s.verdict), '#ffff00'),
      ]),
      /*
        Somebody signs this. The sheet leaves the space blank for a handwritten name, so the form
        needs a rule to write on and a caption saying what goes where — without them the manager
        signs across the middle of the page, which is what the printed copies showed.
      */
      { text: 'Кредит менежери имзоси', alignment: 'center', margin: [0, 40, 0, 14] },
      {
        columns: [
          { width: '*', text: '' },
          { width: 190, text: '_______________________', alignment: 'center' },
          { width: 120, text: '_______________', alignment: 'center' },
          { width: '*', text: '' },
        ],
        columnGap: 10,
      },
      {
        columns: [
          { width: '*', text: '' },
          { width: 190, text: 'Ф.И.Ш.', alignment: 'center', fontSize: 8, color: '#555' },
          { width: 120, text: 'имзо', alignment: 'center', fontSize: 8, color: '#555' },
          { width: '*', text: '' },
        ],
        columnGap: 10,
        margin: [0, 2, 0, 0],
      },
    ],
  };
}
