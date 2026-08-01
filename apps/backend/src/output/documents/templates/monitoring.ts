import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { moneyWithWordsCyr, dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { gridTable, shortDate, lineAgreementNo, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { p, pv, v } from './_shared';
import { autoValueTable, autoFootnotes, realtyFootnotes, shortName, totalAgreedValue } from './_collateral';

type Collateral = CaseDocData['collaterals'][number];

const dash = (v: unknown): string => (v == null || v === '' ? '—' : String(v));

/**
 * Add `months` to `d`, clamping the day-of-month to the last day of the resulting month
 * (e.g. 31 Jan + 1 month → 28/29 Feb, not an overflowed March date). UTC-based to avoid drift.
 */
function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

// The monitoring sheet's real-estate table differs from the act's: the third column is
// "Умумий фойдаланиш майдони" (total area), and the composition sentence is the shorter form.
const REALTY_HEAD: TableCell[] = [
  { text: 'Ушбу кучмас мулк объектнинг таркиби ва таснифи', bold: true, alignment: 'center' },
  { text: 'Яшаш майдони', bold: true, alignment: 'center' },
  { text: 'Умумий фойдаланиш майдони', bold: true, alignment: 'center' },
];

const monitoringComposition = (col: Collateral): string =>
  `Хоналар сони: ${dash(col.roomCount)} та, умумий майдони ${dash(col.totalAreaM2)} кв.м. ` +
  `яшаш майдони - ${dash(col.livingAreaM2)} кв.м., хоналар номи: ${col.roomNames ?? ''}`.trimEnd();

function realtyMonitoringTable(cols: Collateral[]): Content {
  const rows: TableCell[][] = cols.map((col) => [
    { text: monitoringComposition(col) },
    { text: `${dash(col.livingAreaM2)} кв.м.`, alignment: 'center' },
    { text: `${dash(col.totalAreaM2)} кв.м.`, alignment: 'center' },
  ]);
  const totLiving = cols.reduce((s, x) => s + Number(x.livingAreaM2 ?? 0), 0);
  const totTotal = cols.reduce((s, x) => s + Number(x.totalAreaM2 ?? 0), 0);
  return {
    fontSize: 8,
    table: {
      headerRows: 1,
      widths: ['*', 70, 90],
      body: [
        REALTY_HEAD,
        ...rows,
        [
          { text: 'ЖАМИ', bold: true },
          { text: `${totLiving} кв.м.`, bold: true, alignment: 'center' },
          { text: `${totTotal} кв.м.`, bold: true, alignment: 'center' },
        ],
      ],
    },
    layout: gridTable,
    margin: [0, 4, 0, 4],
  };
}

/**
 * Акт мониторинга — «…гаровга кўйилган мол мулкнинг текширув ДАЛОЛАТНОМАСИ», matching the reference
 * sheet: the "Фуқаро … билан имзоланган" heading, the inspector clause, the pledged-property tables
 * (auto — the sheet's 4-column form without a value column; real-estate — composition / яшаш /
 * умумий фойдаланиш майдони) with their footnotes, the total agreed value in Cyrillic words, the
 * visual-inspection sentence, and the two signatures. No org letterhead.
 *
 * Three are generated per case, one per supervision period — months 1-6, 7-12 and 13-18. The
 * inspection happens at the END of its period, so `periodMonths` is 6 / 12 / 18 and the visit date
 * is the application date plus that many months (day-clamped) — never `new Date()`.
 */
export function monitoringTemplate(c: CaseDocData, periodMonths: number): TDocumentDefinitions {
  const org = c.organization;
  const b = c.borrower;
  const name = b?.fullName ?? '—';
  const line = c.creditLine;
  const lineNo = lineAgreementNo(c);
  const lineDate = line?.lineDate ?? null;
  const lineDateStr = lineDate ? shortDate(lineDate) : '—';

  const baseDate = line?.tranches?.[0]?.applicationDate ?? lineDate ?? null;
  const visitDateStr = baseDate ? dateToRuCyrillic(addMonths(baseDate, periodMonths)) : '—';

  const cols = c.collaterals ?? [];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');

  const property: Content[] = [];
  if (autos.length) {
    property.push(autoValueTable(autos, false));
    autos.forEach((a) => property.push(...autoFootnotes(a, c.borrower?.regAddress)));
  }
  if (realty.length) {
    property.push(realtyMonitoringTable(realty));
    realty.forEach((r) => property.push(...realtyFootnotes(r)));
  }
  if (!property.length) property.push({ text: 'Гаров киритилмаган', italics: true });

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      { text: ['Фуқаро ', { text: name, bold: true }, ' билан имзоланган'], alignment: 'center' },
      {
        text: [
          { text: lineDateStr, bold: true },
          ' йилдаги № ',
          { text: String(lineNo), bold: true },
          ' микромолиялаш линияси очиш тўғрисидаги Бош келишувга асосан микроқарз/микрокредитларга гаровга кўйилган мол мулкнинг текширув.',
        ],
        alignment: 'center',
        margin: [0, 2, 0, 2],
      },
      { text: 'ДАЛОЛАТНОМАСИ', bold: true, alignment: 'center', fontSize: 12, margin: [0, 0, 0, 2] },
      // Which supervision period this act covers (months 1-6, 7-12, 13-18).
      { text: `${periodMonths - 5}-${periodMonths} ой мониторинги`, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        columns: [
          { width: '*', text: 'Тошкент шахри' },
          { width: 'auto', text: visitDateStr, bold: true, alignment: 'right' },
        ],
        margin: [0, 0, 0, 10],
      },
      pv(
        'Мен, ', v(org?.nameUpper), ' ижрочи директори ', v(org?.directorShort),
        ' , фуқаро ', v(name), 'нинг иштирокида ', v(lineDateStr), ' йилдаги № ', v(lineNo),
        ' сонли микромолиялаш линиясини очиш тўғрисидаги Бош Келишувга асосан гаровга кўйилган мол - мулкни текширдим',
      ),
      { text: 'Гаров сифатида қуйидаги мулк қабул қилинган:', margin: [0, 6, 0, 2] },
      ...property,
      pv('Юқорида қўрсатилган мулкнинг келишилган гаров қиймати ', v(moneyWithWordsCyr(totalAgreedValue(c))), 'ни ташкил қилади'),
      p('Гаровга қўйилган мулкни визуал текшириши унинг қониқорли холатини кўрсатди.'),
      { text: 'Юқоридагиларни тасдиқлаб имзо қўювчилар:', margin: [0, 10, 0, 8] },
      {
        stack: [
          { text: org?.nameUpper ?? 'ММТ' },
          {
            columns: [
              { width: '*', text: 'ижрочи директори' },
              { width: 'auto', text: `_______________ ${org?.directorShort ?? '—'}`, alignment: 'right' },
            ],
            margin: [0, 2, 0, 12],
          },
          {
            columns: [
              { width: '*', text: 'Қарздор' },
              { width: 'auto', text: `_______________ ${shortName(name)}`, alignment: 'right' },
            ],
          },
        ],
        unbreakable: true,
      },
    ],
  };
}
