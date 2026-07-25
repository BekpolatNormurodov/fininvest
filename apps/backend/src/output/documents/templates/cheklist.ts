import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { assetInsuranceLabelCyr, type LoanProduct } from '@credit-core/shared';
import { CaseDocData } from '../case-document.loader';
import { gridTable, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';

/**
 * The fixed filing order from the reference «перечень» sheet. This is a static form: the operator
 * fills the "Варок" (sheet count) column by hand, so no per-case data is merged in.
 */
const ITEMS: { name: string; copies: string }[] = [
  {
    name:
      'Мижоз бирламчи хужжатлари - паспорт - тех. паспорт ёки кадастр (гаровга кўювчи юридик шахс ' +
      'бўлса: корхона устави, гувохнома, директор тайинлаш бўйича протокол ва приказ, таъқиқга кўйиш ' +
      'бўйича протокол приказ) - загс когоз',
    copies: '(паспортга "Аслидан нусха олинди" деб кредит эксперти уз имзосини куйиши шарт!',
  },
  { name: 'Ўз ўзини банд килганлик тўғрисида хужжат', copies: '1' },
  { name: 'Мурожаатнома (Ходатайство)', copies: '1' },
  { name: 'Асоки маълумотномаси', copies: '1' },
  { name: 'Мижоз анкетаси', copies: '1' },
  { name: 'Скоринг тахлил натижалари', copies: '1' },
  { name: 'МФЛ очиш бўйича бош келишув', copies: '1' },
  { name: 'Бахолаш далолатномаси', copies: '1' },
  { name: 'Гаров Шартномаси', copies: '1' },
  { name: 'Таъкик варақаси', copies: '1' },
  { name: 'Кредит олиш учун ариза', copies: '1' },
  { name: 'Кредит шартномаси ва тўлов жадвали', copies: '1' },
  { name: 'Мижоз аризаси тўлов учун', copies: '1' },
  { name: 'Мемориал ордер', copies: '1' },
  { name: 'Мониторинг далолатномаси', copies: '1' },
  { name: 'Претензионный', copies: '1' },
];

// Asset products (AVTO/IPOTEKA): the purchased asset is the collateral, so the filing set swaps the
// cash-pledge rows for the asset-purchase papers. Cash keeps ITEMS exactly.
const ASSET_ITEMS: { name: string; copies: string }[] = [
  { name: 'Олди-сотди шартномаси', copies: '1' },
  { name: 'Тех. паспорт / кадастр', copies: '1' },
  { name: 'Бахолаш далолатномаси', copies: '1' },
  { name: 'Суғурта полиси (КАСКО / мол-мулк)', copies: '1' },
  { name: 'Бошланғич тўлов квитанцияси', copies: '1' },
];
// Cash-pledge-only rows dropped for asset filings.
const CASH_ONLY_ROWS = new Set(['Гаров Шартномаси', 'Таъкик варақаси', 'Бахолаш далолатномаси']);

const HEADER_ROW: TableCell[] = [
  { text: '№ т/р', bold: true, alignment: 'center' },
  { text: 'Хужжат номланиши', bold: true, alignment: 'center' },
  { text: 'Экз сони', bold: true, alignment: 'center' },
  { text: 'Варок', bold: true, alignment: 'center' },
];

/**
 * перечень — «МФЛ бўйича хужжатлар кетма кетлиги»: the fixed 16-row filing checklist, matching the
 * reference sheet (no org letterhead, «Варок» left blank for hand-fill, credit-manager signature).
 */
export function cheklistTemplate(c: CaseDocData): TDocumentDefinitions {
  const isAsset = assetInsuranceLabelCyr(c.product as LoanProduct | null) !== null;
  const items = isAsset
    ? [...ITEMS.filter((i) => !CASH_ONLY_ROWS.has(i.name)), ...ASSET_ITEMS]
    : ITEMS;
  const rows: TableCell[][] = items.map((item, i) => [
    { text: String(i + 1), alignment: 'center' },
    { text: item.name },
    { text: item.copies, alignment: item.copies === '1' ? 'center' : 'left', fontSize: item.copies === '1' ? 9 : 7 },
    { text: '' },
  ]);

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      { text: 'МФЛ бўйича хужжатлар кетма кетлиги', bold: true, alignment: 'center', fontSize: 12, margin: [0, 0, 0, 12] },
      {
        fontSize: 9,
        table: { headerRows: 1, widths: [30, '*', 120, 44], body: [HEADER_ROW, ...rows] },
        layout: gridTable,
        margin: [0, 2, 0, 14],
      },
      { text: 'Кредит менежери имзоси: _________________________________', margin: [0, 10, 0, 0] },
    ],
  };
}
