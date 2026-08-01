import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { scoreForCase, type ScorableCase } from '@credit-core/shared';
import { dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { gridTable, plainMoney, cyrillicPicklist, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { activityLine } from './_shared';

// Trims: a field cleared to spaces is a blank to fill, not a value. Without this every row of the
// анкета could print whitespace where the form expects «—».
const dash = (v: unknown): string => (v == null || String(v).trim() === '' ? '—' : String(v));
const money = (v: unknown): string => (v == null ? '—' : plainMoney(Number(v)));

/**
 * A label cell — red on the sheet, and red here, because that is how the form is read.
 *
 * Typed as the concrete cell object rather than `TableCell`: that union includes `string`, which
 * cannot be spread when a row needs to add `rowSpan`/`colSpan` to it.
 */
type Cell = { text: string; color?: string; margin: [number, number, number, number] };
const label = (text: string): Cell => ({ text, color: '#c00000', margin: [0, 1, 0, 1] });
const value = (text: string): Cell => ({ text, margin: [0, 1, 0, 1] });

/**
 * МИЖОЗ АНКЕТАСИ — the client questionnaire, sheet «b3» of the reference workbook.
 *
 * Not a summary we invented: it is the sheet the scoring reads its inputs from (education, tenure,
 * housing, deposits, sector, position, length of service) and the one that prints «Карз юки
 * кўрсаткичи» — the debt-burden ratio. Rows follow b3 top to bottom, including the ones the
 * printed sample hides, so nothing the operator entered goes unrecorded.
 *
 * The four declarations at the foot are the client's, transcribed verbatim; the organisation's name
 * is spliced in where the sheet names it.
 */
export function clientProfileTemplate(c: CaseDocData): TDocumentDefinitions {
  const b = c.borrower;
  const emp = c.employment;
  const af = c.affordability;
  const h = c.creditHistory;
  const org = c.organization?.nameUpper ?? 'ММТ';

  /*
    The «қўшимча» rows always printed a dash: they read `phones`, which the wizard never fills. The
    numbers the operator actually enters are the close contacts — the father, the mother, whoever
    else — collected on step 1 and required in pairs.

    `phones` is still read first for any row that carries it, then the contacts fill the rest. The
    borrower's own мобил is excluded so it cannot appear twice.
  */
  const listed = Array.isArray((b as { phones?: unknown })?.phones)
    ? ((b as { phones?: Array<{ number?: string }> }).phones ?? []).map((p) => p?.number)
    : [];
  const contacts = Array.isArray((b as { closeContacts?: unknown })?.closeContacts)
    ? ((b as { closeContacts?: Array<{ phone?: string }> }).closeContacts ?? []).map((x) => x?.phone)
    : [];
  const norm = (v: unknown): string => String(v ?? '').replace(/\D/g, '');
  const extras = [...listed, ...contacts]
    .map((x) => (x ?? '').trim())
    .filter((x) => x && norm(x) !== norm(b?.phone))
    .filter((x, i, a) => a.findIndex((y) => norm(y) === norm(x)) === i);

  /** The sheet prints one мобил line plus three «қўшимча»; empty ones show a dash. */
  const extra = (i: number): string => dash(extras[i]);

  const amountTotal = c.creditLine?.amountTotal ?? c.amount ?? null;

  const n = (v: unknown): number => (v == null ? 0 : Number(v));
  const income = n(af?.mainActivityIncome) + n(af?.secondaryIncome) + n(af?.familyIncome) + n(af?.otherIncome);
  const creditPayments = n(af?.existingCreditBurden) + n(af?.newLoanPayment);
  const expenses = n(af?.utilitiesExpense) + n(af?.familyExpense) + n(af?.otherExpense) + creditPayments;

  // b3!D46 — the same ratio балл!C23 scores on, printed as a percentage.
  const burden = scoreForCase(c as unknown as ScorableCase).ratios.tranchePerIncome;

  /** A group of sub-rows sharing one label spanning them on the left. */
  const group = (name: string, rows: [string, string][]): TableCell[][] =>
    rows.map(([sub, val], i) => [
      i === 0 ? { ...label(name), rowSpan: rows.length } : {},
      label(sub),
      value(val),
    ]);
  /** A single row whose label spans both label columns, as the sheet's ungrouped rows do. */
  const single = (name: string, val: string): TableCell[][] => [
    [{ ...label(name), colSpan: 2 }, {}, value(val)],
  ];

  const body: TableCell[][] = [
    ...single('Мижоз фамилия исм шарифи', dash(b?.fullName)),
    ...single('Жинси', b?.gender === 'FEMALE' ? 'Аёл' : b?.gender === 'MALE' ? 'Эркак' : '—'),
    ...single('фуқаролиги', dash(cyrillicPicklist(b?.citizenship))),
    ...single('Фамилия ўзгарган тақдирда аввалги фамилияси', b?.previousName?.trim() || 'йук'),
    ...single('Туғилган санаси', b?.birthDate ? dateToRuCyrillic(b.birthDate) : '—'),
    ...single('СТИР', dash(b?.inn)),
    ...single('ЖШШИР', dash(b?.pinfl)),
    ...group('Паспорт', [
      ['серия ва рақами', [b?.passportSeries, b?.passportNumber ? `№${b.passportNumber}` : null].filter(Boolean).join(' ') || '—'],
      ['ким томонидан берилган', b?.passportIssuer
        ? `${b.passportIssuer} томонидан${b.passportIssueDate ? ` ${dateToRuCyrillic(b.passportIssueDate)} йилда берилган` : ''}`
        : '—'],
      ['муддати', b?.passportExpiry ? dateToRuCyrillic(b.passportExpiry) : '—'],
    ]),
    ...group('Адрес', [
      ['прописка буйича', dash(b?.regAddress)],
      ['фактический', dash(b?.actualAddress ?? b?.address)],
      // Both columns hold this answer; older rows may carry only the second.
      ['яшаш давомийлиги', dash(b?.regTenure ?? (b as { residenceDuration?: string })?.residenceDuration)],
      ['ориентир', dash(b?.regLandmark ?? b?.actualLandmark)],
    ]),
    ...group('Телефон', [
      ['мобил', dash(b?.phone)],
      ['қўшимча', extra(0)],
      ['қўшимча', extra(1)],
      ['қўшимча', extra(2)],
    ]),
    ...single('Оилавий ахволи', dash(b?.maritalStatus)),
    ...single('Оила аъзолари сони', dash(b?.familySize)),
    ...group('Даромад манбаи', [
      ['Фаолият жойи', activityLine(c)],
      ['Фаолият манзили', dash(emp?.employerAddress)],
      /*
        Д1!C38 — the activity sector, and only that.

        Over 100 million this row used to print the entrepreneur status instead, because that status
        was reaching no other row and the office needed it somewhere. «Фаолият жойи» above carries
        it now, so the substitution only printed the same string twice, one line apart. Owner's
        call: «Соха kerak emas hozircha».

        It reads «—» on most cases because the wizard stopped collecting `sector`. That is worth
        more attention than this row: factor 9 «Сфера деятельности» scores 0 of 6 for every borrower
        for the same reason — 6 points of a 100-point scale dead across the whole book.
      */
      ['Соха', dash(cyrillicPicklist(emp?.sector))],
      ['Лавозими', dash(emp?.position)],
      ['мехнат давомийлиги', dash(emp?.experienceBand)],
    ]),
    ...group('Даромадлари', [
      ['асосий фаолиятдан', money(af?.mainActivityIncome)],
      ['қўшимча фаолиятдан', money(af?.secondaryIncome)],
      ['оила аъзоларини даромади', money(af?.familyIncome)],
      ['бошқалар', money(af?.otherIncome)],
    ]),
    ...group('Харажатлари', [
      ['Коммунал тўловлар', money(af?.utilitiesExpense)],
      ['Оилавий харажатлар', money(af?.familyExpense)],
      ['Кредитлар учун (КАТМ)', money(af?.existingCreditBurden)],
      ['Янги суралган кредит буйича', money(af?.newLoanPayment)],
      ['бошқалар', money(af?.otherExpense)],
    ]),
    ...single('Жами кредит туловлари', plainMoney(creditPayments)),
    ...single('Жами даромадлари', plainMoney(income)),
    ...single('Жами харажатлари', plainMoney(expenses)),
    ...single('Шу жумладан кредитлар буйича жами харажатлар', plainMoney(creditPayments)),
    ...single('Маълумоти', dash(b?.education)),
    ...single('Яшаш жойи тури', dash(b?.ownsHome)),
    ...single('Банкларда омонат хисобракамлари', dash(b?.depositsBand)),
    ...single('Бошка банкларда кредитларнинг мавжудлиги', dash(h?.loansOver5MFlag)),
    ...single('МКО/ ломбардлардан қарздорликлари', dash(h?.priorMfiPawnshopFlag)),
    [
      { ...label('Карз юки курсаткичи'), colSpan: 2 },
      {},
      { text: burden != null ? `${Math.round(burden * 100)}%` : '—', bold: true, alignment: 'center', margin: [0, 1, 0, 1] },
    ],
  ];

  const declaration = (text: string): Content => ({ text, alignment: 'justify', fontSize: 9, margin: [0, 0, 0, 6] });

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      { text: 'МИЖОЗ АНКЕТАСИ', bold: true, alignment: 'center', fontSize: 12, margin: [0, 0, 0, 8] },
      {
        // Dense on purpose — the sheet fits this on one page and the operator reads it as a form.
        fontSize: 8,
        table: { headerRows: 0, widths: [66, 104, '*'], body },
        layout: gridTable,
      },
      {
        columns: [
          { width: '*', text: 'Маълумотлар хаққонийлигини тасдиқлайман:', margin: [0, 14, 0, 0] },
          { width: 'auto', text: '_____________________ (имзо)', alignment: 'right', margin: [0, 14, 0, 0] },
        ],
        margin: [0, 0, 0, 14],
      },
      declaration(
        `Ушбу анкетадаги маълумотлар исталган вактда ${org} ходимлари томонидан хар қандай манбалар ва ` +
        'маълумотлардан фойдаланган холда текширилиши ва қайта текширилиши мумкин',
      ),
      declaration(
        `Ушбу анкетани ${org} томонидан қабул қилиниши, ${org} га менга микрокредит бериш мажбуриятинини юкламайди.`,
      ),
      declaration('Шу анкета орқали Мен, ўзим, яқин қаришдошларим ёки юқори мансабдор шахс эмаслигини тасдиқлайман.'),
      declaration(
        'Барча харакатларда факат ўз манфаатим учун харакат қиламан ва хеч қайси бошқа шахслар манфаатларини химоя қилмайман.',
      ),
      declaration(
        `Мен, ${dash(b?.fullName)}, ушбу анкетада кўрсатилган "даромадлари" бандини менинг даромад ` +
        'маълумотларим сифатида қабул қилишингизни, хамда молиявий тахлилда фойдаланишингизни сўрайман.',
      ),
    ],
  };
}
