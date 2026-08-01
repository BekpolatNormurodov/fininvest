import type { Content, TableCell } from 'pdfmake/interfaces';
import type { CaseDocData } from './case-document.loader';
import { dateToRuCyrillic } from '../../common/sum-to-words.util';

/**
 * Diagonal watermark for a case status: the text + colour. Pending review → grey "TASDIQLANMAGAN";
 * once the director signs (ADMIN_FINALIZE) and after finalize → green "TASDIQLANGAN"; rejected/
 * cancelled → red. null when no watermark applies (e.g. DRAFT — no documents yet).
 */
export function watermarkForStatus(status: string): { text: string; color: string } | null {
  if (status === 'REJECTED') return { text: 'РАД ЭТИЛГАН', color: '#dc2626' };
  if (status === 'CANCELLED') return { text: 'БЕКОР ҚИЛИНГАН', color: '#dc2626' };
  if (status === 'MODERATION' || status === 'DIRECTOR_REVIEW') return { text: 'ТАСДИҚЛАНМАГАН', color: '#9ca3af' };
  if (status === 'ADMIN_FINALIZE' || status === 'FINALIZED') return { text: 'ТАСДИҚЛАНГАН', color: '#16a34a' };
  return null;
}

/**
 * The status badge shown next to a document in the UI. Mirrors the watermark, but as a labelled
 * tone the frontend can colour: pending (grey) while under review, approved (green) once the director
 * has signed (FINALIZED / legacy ADMIN_FINALIZE), rejected (red) if the case was refused/cancelled.
 * null for DRAFT (no documents yet).
 */
export type DocBadgeTone = 'pending' | 'approved' | 'rejected';
export function docBadgeForStatus(status: string): { label: string; tone: DocBadgeTone } | null {
  switch (status) {
    case 'FINALIZED':
    case 'ADMIN_FINALIZE':
      return { label: 'Tasdiqlangan', tone: 'approved' };
    case 'MODERATION':
    case 'DIRECTOR_REVIEW':
      return { label: 'Tasdiqlanmagan', tone: 'pending' };
    case 'REJECTED':
      return { label: 'Rad etilgan', tone: 'rejected' };
    case 'CANCELLED':
      return { label: 'Bekor qilingan', tone: 'rejected' };
    default:
      return null;
  }
}

export const money = (n: unknown): string =>
  n == null ? '—' : new Intl.NumberFormat('ru-RU').format(Number(n)) + " so'm";

/**
 * Picklist values stored in Latin, rendered in the alphabet the documents are written in.
 *
 * «где то лотинча где то кирил». Two of the wizard's dropdowns are code-owned constants in Latin —
 * ENTREPRENEUR_TYPES and NATIONALITY_UZ — and both print straight into Cyrillic forms: «Yakka
 * tartibdagi tadbirkor» lands in «Фаолият жойи» on the анкета, the score report and the credit
 * application; «O‘zbekiston Respublikasi» lands in «фуқаролиги».
 *
 * Translating at print time rather than editing the constants is deliberate. Rows already in the
 * database hold the Latin strings, so changing the source would fix new cases and leave every
 * existing one printing Latin — the same complaint with a smaller blast radius. This catches both
 * and needs no migration.
 *
 * Anything not in the table passes through untouched — a name, an employer, a hand-typed value.
 * This translates a closed list; it does not transliterate Uzbek.
 */
const CYRILLIC_PICKLIST: Record<string, string> = {
  // ENTREPRENEUR_TYPES. Apostrophes vary by keyboard, so keys are normalised before lookup.
  'yakka tartibdagi tadbirkor': 'Якка тартибдаги тадбиркор',
  'ozini ozi band qilgan': 'Ўзини ўзи банд қилган',
  // NATIONALITY_UZ — the ones an Uzbek MFI actually sees.
  'ozbekiston respublikasi': 'Ўзбекистон Республикаси',
  'ozbekiston': 'Ўзбекистон',
  'rossiya federatsiyasi': 'Россия Федерацияси',
  'qozogiston': 'Қозоғистон',
  'qirgiziston': 'Қирғизистон',
  'tojikiston': 'Тожикистон',
  'turkmaniston': 'Туркманистон',
  'ozarbayjon': 'Озарбайжон',
  'armaniston': 'Арманистон',
  'gruziya': 'Грузия',
  'belarus': 'Беларусь',
  'ukraina': 'Украина',
  'moldova': 'Молдова',
  'turkiya': 'Туркия',
  'afgoniston': 'Афғонистон',
  'xitoy': 'Хитой',
  'janubiy koreya': 'Жанубий Корея',
  'hindiston': 'Ҳиндистон',
  'pokiston': 'Покистон',
  'eron': 'Эрон',
  'aqsh': 'АҚШ',
  'germaniya': 'Германия',
  'buyuk britaniya': 'Буюк Британия',
};

/** Cyrillic form of a known picklist value; the value itself when it is not one. */
export function cyrillicPicklist(v: string | null | undefined): string | null | undefined {
  if (typeof v !== 'string') return v;
  // «O‘zbekiston», «O'zbekiston» and «Ozbekiston» are one answer typed on three keyboards.
  const key = v.toLowerCase().replace(/[’‘'`ʻʼ]/g, '').replace(/\s+/g, ' ').trim();
  return CYRILLIC_PICKLIST[key] ?? v;
}

/**
 * The one address the forms print for the borrower — «Манзил».
 *
 * The workbook gives the contract, the ходатайство, the бош келишув, the score report and the
 * credit application a single address cell, Д1!C20, and C20 is the propiska. So the propiska is
 * what «Манзил» carries, and the anketa is the only form with two rows (Д2!D13 registered,
 * Д2!D14 actual) — leave that one alone.
 *
 * Every site used to spell this as `b?.regAddress ?? b?.address ?? '—'`, and that chain has two
 * holes. `??` does not skip an empty string, so a cleared field printed «Манзил: » with the next
 * label immediately after it — measured on the contract, the бош келишув, the ходатайство, the
 * score report and the disbursement request. And `actualAddress` was never in the chain at all, so
 * a case that carried only the actual address printed «—» while holding an address.
 *
 * `||` rather than `??` on purpose: rows written before the DTO started trimming, seeds and direct
 * Prisma writes can all still hold `''`, and those must fall through too.
 */
export function borrowerAddress(b: {
  regAddress?: string | null;
  address?: string | null;
  actualAddress?: string | null;
} | null | undefined): string {
  const pick = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return pick(b?.regAddress) || pick(b?.address) || pick(b?.actualAddress) || '—';
}

/**
 * The бош келишув number — «№ 0000 СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ КЕЛИШУВ».
 *
 * A case carries two numbers, not one. This is the credit LINE's: the обложка, the РКЛ Ген, the
 * приказ, the акт and the мониторинг all head or cite the line agreement. The contract carries the
 * other one, the full «2012 MFL 1320 PS».
 *
 * It is `contractYearlyNo`, assigned at submit alongside the contract number — the design settled
 * that (docs/superpowers/specs/2026-07-09-contract-number-remfl-design.md §6: «Liniya № (РКЛ)» →
 * contractYearlyNo, avto, read-only). Nothing new is generated here; a second stored column would
 * hold the same value while being free to drift from the one the contract number is built from.
 *
 * `creditLine.lineNumber` still wins when it is set, so a number an operator typed on an older case
 * keeps printing.
 *
 * There is no fall-through to the contract number. All five documents used to end
 * `?? c.contractNumber ?? c.number`, so a dossier printed one number under two different labels and
 * looked right. A case with no number yet says «—», which is true.
 */
export function lineAgreementNo(c: {
  creditLine?: { lineNumber?: string | null } | null;
  contractYearlyNo?: number | null;
}): string {
  const typed = c.creditLine?.lineNumber?.trim();
  if (typed) return typed;
  return c.contractYearlyNo != null ? String(c.contractYearlyNo) : '—';
}

/**
 * Shared document defaults — bumped line height (1.15, per the "kattaroq line orasi" request) so
 * every rebuilt template reads like the Excel forms. Templates spread this into `defaultStyle`.
 */
export const DOC_DEFAULT_STYLE = { font: 'Roboto', fontSize: 10, lineHeight: 1.15 } as const;
export const DOC_PAGE_MARGINS: [number, number, number, number] = [45, 50, 45, 50];

/** Centered, bold, larger chapter/section heading (e.g. "1. КЕЛИШУВ ПРЕДМЕТИ"). */
export function sectionTitle(text: string): Content {
  return { text, bold: true, fontSize: 11.5, alignment: 'center', margin: [0, 10, 0, 6] };
}

/** Left-aligned bold sub-heading inside a form section. */
export function subHeading(text: string): Content {
  return { text, bold: true, fontSize: 11, margin: [0, 8, 0, 4] };
}

/** Plain grouped number with 2 decimals, no "so'm" suffix — as the schedule prints amounts. */
export const plainMoney = (n: unknown): string => {
  if (n == null) return '';
  const v = Number(n);
  if (Number.isNaN(v)) return '';
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(v)
    .replace(/\s/g, ' ');
};

/** Numeric date dd.mm.yyyy (UTC), as the schedule column prints it. */
export const shortDate = (d: Date): string => {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};

/**
 * The two-party «Микромолия ташкилоти» / «Қарздор» requisites + signature block that closes the
 * schedule and the bosh kelishuv. Org details from the Organization record, borrower from the case.
 */
export function partyRequisites(c: CaseDocData): Content {
  const org = c.organization;
  const b = c.borrower;
  const passport = [b?.passportSeries, b?.passportNumber ? `№${b.passportNumber}` : null].filter(Boolean).join(' ');
  const passportLine = passport
    ? `паспорт: ${passport}${b?.passportIssuer ? `, ${b.passportIssuer} томонидан` : ''}${b?.passportIssueDate ? ` ${dateToRuCyrillic(b.passportIssueDate)} берилган` : ''}`
    : 'паспорт: —';
  const mmt: Content[] = [
    { text: '«Микромолия ташкилоти»', bold: true },
    { text: org?.nameUpper ?? '—' },
    { text: `Адрес: ${org?.address ?? '—'}` },
    { text: `р/с: №${org?.bankAccount ?? '—'}` },
    { text: `МФО: №${org?.bankMfo ?? '—'} в ${org?.bankName ?? '—'}` },
    { text: `ИНН: ${org?.inn ?? '—'}` },
    // The firm's own contact lines — the reference block prints two numbers, the second bare.
    ...(org?.phone ? [{ text: `Тел: ${org.phone}` }] : []),
    ...(org?.phone2 ? [{ text: org.phone2 }] : []),
    { text: ' ' },
    { text: 'Ижрочи директор' },
    { text: org?.directorShort ?? '—', bold: true },
  ];
  const debtor: Content[] = [
    { text: '«Қарздор»', bold: true },
    { text: b?.fullName ?? '—' },
    { text: `Манзил: ${borrowerAddress(b)}` },
    { text: passportLine },
    { text: `Тел: ${b?.phone ?? '—'}` },
  ];
  /*
    Pad the shorter column instead of counting blank rows by hand.
    The two signature lines have to sit level, and the number of rows above them changes with the
    data — a second firm phone, a missing passport. The old fixed spacers had to be re-counted every
    time a row was added, and were wrong the moment one was.
  */
  while (mmt.length < debtor.length) mmt.splice(mmt.length - 2, 0, { text: ' ' });
  while (debtor.length < mmt.length) debtor.push({ text: ' ' });
  mmt.push({ text: '________________', margin: [0, 6, 0, 0] });
  debtor.push({ text: '________________ (имзо)', margin: [0, 6, 0, 0] });
  return {
    columns: [
      { width: '*', stack: mmt, fontSize: 9 },
      { width: '*', stack: debtor, fontSize: 9 },
    ],
    columnGap: 24,
    margin: [0, 16, 0, 0],
  };
}

/** A two-column label/value row for a pdfmake table body. */
export const kv = (label: string, val: string): TableCell[] => [
  { text: label, bold: true, margin: [0, 3, 0, 3] },
  { text: val || '—', margin: [0, 3, 0, 3] },
];

/** Clean grid layout for a key/value or data table — thin light-gray borders + comfortable padding. */
export const gridTable = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#c8d0da',
  vLineColor: () => '#c8d0da',
  paddingTop: () => 5,
  paddingBottom: () => 5,
  paddingLeft: () => 8,
  paddingRight: () => 8,
};

/** Wrap key/value rows in a bordered two-column table. */
export function kvTable(rows: TableCell[][], labelWidth: number | string = 190): Content {
  return { table: { widths: [labelWidth, '*'], body: rows }, layout: gridTable, margin: [0, 2, 0, 4] };
}

/** Centered document title (bold) with an optional subtitle line under it. */
export function docTitle(title: string, subtitle?: string): Content {
  const stack: Content[] = [{ text: title, bold: true, fontSize: 14, alignment: 'center' }];
  if (subtitle) stack.push({ text: subtitle, alignment: 'center', color: '#444', fontSize: 9.5, margin: [0, 2, 0, 0] });
  return { stack, margin: [0, 4, 0, 12] };
}

/** Two-column signature block (left party / right party). */
export function signatures(left: string[], right: string[]): Content {
  const col = (lines: string[]) => ({
    width: '*',
    stack: [
      ...lines.map((t, i) => ({ text: t, bold: i === 0 })),
      { text: '\n___________________', margin: [0, 4, 0, 0] as [number, number, number, number] },
    ],
  });
  return { columns: [col(left), col(right)], columnGap: 24, margin: [0, 22, 0, 0] };
}

/** Org letterhead block from the Organization record — centered name + address, with a divider rule. */
export function orgHeader(org: CaseDocData['organization']): Content {
  return {
    stack: [
      { text: org?.nameUpper ?? 'МКО', bold: true, fontSize: 12, alignment: 'center' },
      { text: org?.address ?? '', fontSize: 8, color: '#555', alignment: 'center' },
      { text: [org?.bankName, org?.bankAccount].filter(Boolean).join(' · '), fontSize: 8, color: '#555', alignment: 'center' },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 505, y2: 4, lineWidth: 0.8, lineColor: '#94a3b8' }], margin: [0, 4, 0, 0] },
    ],
    margin: [0, 0, 0, 14],
  };
}
