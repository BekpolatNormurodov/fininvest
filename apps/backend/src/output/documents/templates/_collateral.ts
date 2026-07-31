import type { Content, TableCell } from 'pdfmake/interfaces';
import { assetInsuranceLabelCyr, type LoanProduct } from '@credit-core/shared';
import { moneyWithWordsCyr } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { gridTable, shortDate } from '../doc-layout';

type Collateral = CaseDocData['collaterals'][number];

const dash = (v: unknown): string => (v == null || v === '' ? '—' : String(v));
const owner = (c: Collateral): string => c.owners?.[0]?.fullName ?? '—';

/**
 * The initial of a name, as a letter rather than as a character.
 *
 * Uzbek Latin writes four letters with two characters — sh, ch, o‘ and g‘ — so taking the first
 * character abbreviated SHUXRAT to «S.» and CHORI to «C.», which are different letters and a
 * different person. Cyrillic has no such pair, and is unaffected.
 *
 * The apostrophe forms vary by keyboard (’ ‘ ' `), so all of them count.
 */
export function nameInitial(word: string): string {
  const w = word.trim();
  if (!w) return '';
  const two = w.slice(0, 2).toUpperCase();
  if (two === 'SH' || two === 'CH') return two;
  // o‘ / g‘ — the letter is the vowel plus its tail.
  if (/^[OG][’‘'`ʻʼ]/i.test(w)) return w.slice(0, 2).toUpperCase();
  return w.charAt(0).toUpperCase();
}

/** Short "SURNAME N.P." form of a full name, as the forms abbreviate owners (e.g. "UBAYDULLAYEV Z.N."). */
export function shortName(full: string | null | undefined): string {
  if (!full) return '—';
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const initials = parts.slice(1).map((p) => nameInitial(p) + '.').join('');
  return `${parts[0]} ${initials}`;
}

// ── AUTO ─────────────────────────────────────────────────────────────────────

/** Prose auto-collateral description, as the Кредитная заявка / shartnoma print it. */
export function autoDescription(c: Collateral): string {
  return (
    `${shortName(owner(c))} га тегишли давлат рақам белгиси ${dash(c.stateNumber)}, ` +
    `тип кузова - ${dash(c.bodyType)}, кузов №${dash(c.bodyNo)}, ` +
    `двигатель №${dash(c.engineNo)}, шасси - ${dash(c.chassis)}, ` +
    `ранги - ${dash(c.color)}, ${dash(c.year)} йилда ишлаб чиқарилган., ` +
    `${dash(c.model)} русумли автомототранспорт гарови. ` +
    `Гаров қиймати нархи ${moneyWithWordsCyr(c.agreedValue)}.`
  );
}

// Headers verbatim from the Excel, including the trailing asterisks that key the footnotes below.
const AUTO_HEAD_BASE: TableCell[] = [
  { text: 'Мулк номи*', bold: true, alignment: 'center' },
  { text: 'Кузов тури ва кузов рақами*', bold: true, alignment: 'center' },
  { text: 'Двигател рақами ва шасси рақами*', bold: true, alignment: 'center' },
  { text: 'Ишлаб чиқарилган йили ва ранги*', bold: true, alignment: 'center' },
];
const AUTO_VALUE_COL: TableCell = { text: 'Гаров қийматининг келишилган нархи, сўм', bold: true, alignment: 'center' };

/** The auto value table. `withValue` adds the "Гаров қиймати" column (Приказ / act table 2). */
export function autoValueTable(collaterals: Collateral[], withValue = true): Content {
  const header = withValue ? [...AUTO_HEAD_BASE, AUTO_VALUE_COL] : AUTO_HEAD_BASE;
  const rows: TableCell[][] = collaterals.map((c) => {
    const row: TableCell[] = [
      { text: dash(c.model) },
      { text: `тип кузова - ${dash(c.bodyType)}, кузов №${dash(c.bodyNo)}` },
      { text: `двигатель №${dash(c.engineNo)}, шасси - ${dash(c.chassis)}` },
      { text: `ранги - ${dash(c.color)}, ${dash(c.year)} йилда ишлаб чиқарилган.` },
    ];
    if (withValue) row.push({ text: moneyWithWordsCyr(c.agreedValue) });
    return row;
  });
  const widths = withValue ? [70, '*', '*', 78, 92] : [80, '*', '*', 90];
  return {
    fontSize: 8,
    table: { headerRows: 1, widths, body: [header, ...rows] },
    layout: gridTable,
    margin: [0, 4, 0, 6],
  };
}

/**
 * Footnote lines under the auto table (эгаси / тех паспорт / гараж / давлат рақами).
 *
 * `regAddress` is the borrower's registered address, used when the collateral carries none. A car
 * has no address of its own — the operator never fills that field — so this line printed «—» on
 * every auto case, while the address it is asking for was already on the borrower. The label is the
 * workbook's own and stays as it is; only the value it was missing is supplied.
 */
export function autoFootnotes(c: Collateral, regAddress?: string | null): Content[] {
  const tp = c.techPassportNo
    ? `${c.techPassportNo}${c.techPassportDate ? ` от ${shortDate(c.techPassportDate)} г.` : ''}`
    : '—';
  return [
    { text: `* Автомототранспорт воситаси эгаси: ${owner(c)}`, fontSize: 9 },
    { text: `* техник паспорт рақами: ${tp}`, fontSize: 9 },
    { text: `* рўйхатдан ўтган манзил/гараж манзили: ${dash(c.address ?? regAddress ?? null)}`, fontSize: 9 },
    { text: `* давлат рақами: ${dash(c.stateNumber)}`, fontSize: 9 },
  ];
}

// ── REAL ESTATE ──────────────────────────────────────────────────────────────

/**
 * The registry classification the forms print for a pledged property — e.g.
 * "YAKKA TARTIBDAGI TURAR JOY" (house) or "KO'P QAVATLI UYDAGI XONADON" (apartment).
 * Comes from the stored `propertyType`; falls back to the realtyKind wording when absent.
 */
export function realtyWord(c: Collateral): string {
  if (c.propertyType) return c.propertyType;
  return c.realtyKind === 'HOUSE' ? 'YAKKA TARTIBDAGI TURAR JOY' : "KO'P QAVATLI UYDAGI XONADON";
}

/**
 * The composition sentence used in the first cell of the real-estate table.
 * Wording/spelling copied verbatim from the reference Excel ("кучмас", "руйхатидан утказилган",
 * "(ташки)") so the printed form is identical to it.
 */
export function realtyComposition(c: Collateral): string {
  return (
    `Хоналар сони: ${dash(c.roomCount)} та, ` +
    `Давлат руйхатидан утказилган ер майдони - ${dash(c.landAreaM2)} кв.м., ` +
    `умумий майдони (ташки) - ${dash(c.totalAreaM2)} кв.м., ` +
    `умумий фойдали майдони - ${dash(c.usableAreaM2)} кв.м., ` +
    `яшаш майдони - ${dash(c.livingAreaM2)} кв.м..`
  );
}

/**
 * Prose real-estate description, verbatim in the Кредитная заявка / Мурожаатнома shape:
 * "<address> манзилда жойлашган, Давлат руйхатидан утказилган ер майдони - X кв.м., курилиш ости
 *  майдони - Y кв.м., умумий фойдали майдони - Z кв.м., яшаш майдони - W кв.м., бўлган,
 *  <OWNER S.N.>га тегишли <PROPERTY TYPE> гарови. Гаров қиймати нархи <sum>."
 */
export function realtyDescription(c: Collateral): string {
  return (
    `${dash(c.address)} манзилда жойлашган, ` +
    `Давлат руйхатидан утказилган ер майдони - ${dash(c.landAreaM2)} кв.м., ` +
    `курилиш ости майдони - ${dash(c.totalAreaM2)} кв.м., ` +
    `умумий фойдали майдони - ${dash(c.usableAreaM2)} кв.м., ` +
    `яшаш майдони - ${dash(c.livingAreaM2)} кв.м., бўлган, ` +
    `${shortName(owner(c))}га тегишли ${realtyWord(c)} гарови. ` +
    `Гаров қиймати нархи ${moneyWithWordsCyr(c.agreedValue)}.`
  );
}

/** Real-estate value table (Акт согласования / Приказ). `withValue` adds the залоговая стоимость column. */
export function realtyValueTable(collaterals: Collateral[], withValue = true): Content {
  // Headers verbatim from the Excel — note the value column is Russian there, unlike the auto table.
  const header: TableCell[] = [
    { text: 'Ушбу кучмас мулк объектнинг таркиби ва таснифи', bold: true, alignment: 'center' },
    { text: 'Яшаш майдони', bold: true, alignment: 'center' },
    { text: 'Давлат руйхатидан утказилган ер майдони', bold: true, alignment: 'center' },
  ];
  // "стоимонсть" is the reference sheet's own spelling — kept verbatim so the form matches 1:1.
  if (withValue) header.push({ text: 'Согласованная залоговая стоимонсть, сум', bold: true, alignment: 'center' });

  const rows: TableCell[][] = collaterals.map((c) => {
    const row: TableCell[] = [
      { text: realtyComposition(c) },
      { text: `${dash(c.livingAreaM2)} кв.м.`, alignment: 'center' },
      { text: `${dash(c.landAreaM2)} кв.м.`, alignment: 'center' },
    ];
    if (withValue) row.push({ text: moneyWithWordsCyr(c.agreedValue) });
    return row;
  });

  const totalLiving = collaterals.reduce((s, c) => s + Number(c.livingAreaM2 ?? 0), 0);
  const totalLand = collaterals.reduce((s, c) => s + Number(c.landAreaM2 ?? 0), 0);
  const totalRow: TableCell[] = [
    { text: 'ЖАМИ', bold: true },
    { text: `${totalLiving} кв.м.`, bold: true, alignment: 'center' },
    { text: `${totalLand} кв.м.`, bold: true, alignment: 'center' },
  ];
  /*
    The Excel leaves the value cell of the ЖАМИ row EMPTY — checked against the Приказ sheet, where
    row 19 carries the sum and row 20 (ЖАМИ) has no E cell at all. Repeating it printed the agreed
    value twice, one under the other, which read as two different valuations.

    Still a cell, not a dropped column: the row has to keep the table's shape.
  */
  if (withValue) totalRow.push({ text: '' });

  const widths = withValue ? ['*', 60, 78, 92] : ['*', 78, 104];
  return {
    fontSize: 8,
    table: { headerRows: 1, widths, body: [header, ...rows, totalRow] },
    layout: gridTable,
    margin: [0, 4, 0, 6],
  };
}

/** Footnote lines under the real-estate table (эгаси / реестр / кадастр / манзил). */
export function realtyFootnotes(c: Collateral): Content[] {
  return [
    { text: `-* кўчмас мулк эгаси: ${owner(c)}`, fontSize: 9 },
    { text: `-* реестр рақами: ${dash(c.registryNo)}`, fontSize: 9 },
    { text: `-* кадастр рақами: ${dash(c.cadastreNo)}`, fontSize: 9 },
    { text: `-* манзил: ${dash(c.address)}`, fontSize: 9 },
  ];
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/** True when the case is backed only by vehicles (drives "полис скрыть" and auto-only wording). */
export function isAutoOnly(c: CaseDocData): boolean {
  const cols = c.collaterals ?? [];
  return cols.length > 0 && cols.every((x) => x.type === 'AUTO');
}

/** Акт table 1 — the DECLARED composition (no value column) + footnotes, per type. */
export function collateralDeclaredBlock(c: CaseDocData): Content[] {
  const cols = c.collaterals ?? [];
  if (cols.length === 0) return [{ text: 'Гаров киритилмаган', italics: true }];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');
  const out: Content[] = [];
  if (autos.length) {
    out.push(autoValueTable(autos, false));
    autos.forEach((a) => out.push(...autoFootnotes(a, c.borrower?.regAddress)));
  }
  if (realty.length) {
    out.push(realtyValueTable(realty, false));
    realty.forEach((r) => out.push(...realtyFootnotes(r)));
  }
  return out;
}

/** Акт table 2 — the AGREED value tables (with the залоговая стоимость column), no footnotes. */
export function collateralAgreedTables(c: CaseDocData): Content[] {
  const cols = c.collaterals ?? [];
  if (cols.length === 0) return [];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');
  const out: Content[] = [];
  if (autos.length) out.push(autoValueTable(autos, true));
  if (realty.length) out.push(realtyValueTable(realty, true));
  return out;
}

/** Total agreed collateral value (sum of agreedValue across collaterals). */
export function totalAgreedValue(c: CaseDocData): number {
  return (c.collaterals ?? []).reduce((s, x) => s + Number(x.agreedValue ?? 0), 0);
}

/** Full collateral block (table + footnotes) for a form, dispatching per type. */
export function collateralBlock(c: CaseDocData, opts: { realtyWithValue?: boolean } = {}): Content[] {
  const cols = c.collaterals ?? [];
  if (cols.length === 0) return [{ text: 'Гаров киритилмаган', italics: true }];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');
  const out: Content[] = [];
  if (autos.length) {
    out.push(autoValueTable(autos));
    autos.forEach((a) => out.push(...autoFootnotes(a, c.borrower?.regAddress)));
  }
  if (realty.length) {
    out.push(realtyValueTable(realty, opts.realtyWithValue ?? true));
    realty.forEach((r) => out.push(...realtyFootnotes(r)));
  }
  return out;
}

/**
 * The contract's 3.1.1 «Гаров предмети» — one PROSE paragraph per pledge, not a table.
 *
 * The Excel contract writes this out in sentences (sheet «договор узб», A24/A25); only the Приказ,
 * the Акт and the Бош келишув use the table. We printed the table here too, which is why the
 * contract read like a spreadsheet next to the reference.
 *
 * The wording is that sheet's, including its unevenness — «сум»/«сўмни», and the ипотека vs гаров
 * шартномаси split between property and vehicle.
 */
export function contractCollateralProse(
  c: CaseDocData,
  opts: { actNo?: string; actDateStr?: string } = {},
): Content[] {
  const cols = c.collaterals ?? [];
  if (!cols.length) return [{ text: 'Гаров киритилмаган', italics: true }];

  const actNo = opts.actNo ?? '1';
  const actDate = opts.actDateStr ?? '—';
  const borrower = c.borrower?.fullName ?? '—';

  // Asset products (AVTO/IPOTEKA): the purchased asset IS insured (KASKO / property). Cash and legacy
  // cases return null → the sheet's own «сугурталанмайди» is preserved byte-for-byte.
  const insCyr = assetInsuranceLabelCyr(c.product as LoanProduct | null);
  const insuranceSentence = insCyr
    ? `Гаров объекти ${insCyr} бўйича суғурталанади.` // TODO(legal): yakuniy so'zlashuvni tasdiqlang
    : 'Гаров объекти сугурталанмайди.';

  return cols.map((col) => {
    const pledgor = col.owners?.[0]?.fullName ?? borrower;
    const opening =
      `3.1.1. Микромолия ташкилоти, ${pledgor} томонидан микромолия ташкилоти ва Қарздор томонидан ` +
      `${actDate}да имзоланган №${actNo} сонли Гаров предмети қийматини тасдиқлаш далолатномасига мувофиқ `;

    const subject = col.type === 'AUTO'
      ? `${pledgor}га тегишли ${dash(col.year)} йил ишлаб чиқарилган, ранги - ${dash(col.color)}, ` +
        `двигатели рақами ${dash(col.engineNo)}, шасси - ${dash(col.chassis)}, кузов тури - ${dash(col.bodyType)}, ` +
        `кузов №${dash(col.bodyNo)}, давлат рақам белгиси ${dash(col.stateNumber)} бўлган ${dash(col.model)} ` +
        `русумли автомашинаси (бундан кейин “Гаров предмети”) ${pledgor}, `
      : `${dash(col.address)} манзилда жойлашган, ` +
        `Давлат руйхатидан утказилган ер майдони - ${dash(col.landAreaM2)} кв.м., ` +
        `умумий майдони (ташки) - ${dash(col.totalAreaM2)} кв.м., ` +
        `умумий фойдали майдони - ${dash(col.usableAreaM2)} кв.м., ` +
        `яшаш майдони - ${dash(col.livingAreaM2)} кв.м., бўлган ${realtyWord(col)}, ` +
        `(бундан кейин – «Гаров Предмети») ${pledgor} га тегишли `;

    // The property paragraph names an ипотека шартномаси; the vehicle one a гаров шартномаси.
    const deed = col.type === 'AUTO' ? 'гаров шартномаси' : 'ипотека шартномаси';

    return {
      text:
        opening + subject +
        `ва келишилган гаров қиймати ${actDate}даги №${actNo} гаров предмети қийматини тасдиқлаш ` +
        `далолатномасига мувофиқ ${moneyWithWordsCyr(col.agreedValue)}ни ташкил қилади. ` +
        `Гаровнинг аниқ шартлари тегишли тарзда нотариал тасдиқланган ${deed} билан белгиланади. ` +
        insuranceSentence,
      alignment: 'justify',
      margin: [0, 2, 0, 4],
    } as Content;
  });
}
