import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUzCyrillic, dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { sectionTitle, shortDate, lineAgreementNo, borrowerAddress, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { p, wordsCyr } from './_shared';
import { realtyWord, isAutoOnly } from './_collateral';
import { RKL_LINES, type RklSlot } from './rkl-body';

/**
 * The asset-product бош келишув — «РКЛ Ген» of «АВТО мфл APEX (2).xlsx».
 *
 * A different document from the cash agreement in rkl-gen.ts, not a revision of it: a clause-by-
 * clause comparison found 40 clauses in the reference that ours does not carry. So the two live
 * side by side and the product picks, exactly as the contract does:
 *
 *   AVTO / IPOTEKA  → here
 *   ADM TEAM / OSON → rkl-gen.ts, byte-for-byte as it was
 *
 * The static text comes from rkl-body.ts, machine-copied from the sheet. This file supplies the six
 * places that carry the case, in the sheet's own wording — including its own spelling and its own
 * numbering slips, because the form is the agreed text.
 */
export function rklApexTemplate(c: CaseDocData, notary = false): TDocumentDefinitions {
  const slots = buildSlots(c);
  const content: Content[] = [];

  for (const row of RKL_LINES) {
    if (row.kind === 'heading') content.push(sectionTitle(row.text));
    else if (row.kind === 'text') content.push(p(row.text));
    else content.push(...slots[row.slot]);
  }

  content.push(sectionTitle('7. ТОМОНЛАРНИНГ ЮРИДИК МАНЗИЛЛАРИ ВА РEКВИЗИТЛАРИ:'));
  content.push(requisitesBlock(c));
  if (notary) content.push(notaryTail(c));

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content,
    styles: { h1: { fontSize: 13, bold: true, margin: [0, 0, 0, 6] } },
  };
}

// ── slots ────────────────────────────────────────────────────────────────────

/** Amount and words, without the trailing «сўм» — this sheet writes its own unit after it. */
function moneyBare(amount: unknown): string {
  if (amount == null) return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(n).replace(/\s/g, ' ');
  return `${formatted} (${sumToWordsUzCyrillic(n)})`;
}

const dash = (v: unknown): string => (v == null || v === '' ? '—' : String(v));
type Collateral = CaseDocData['collaterals'][number];

function buildSlots(c: CaseDocData): Record<RklSlot, Content[]> {
  const line = c.creditLine;
  const b = c.borrower;
  const org = c.organization;
  const ins = line?.insurance;

  const amount = line?.amountTotal ?? c.amount ?? null;
  const term = line?.termMonths ?? null;
  const startStr = line?.lineDate ? dateToRuCyrillic(line.lineDate) : '—';
  const endStr = line?.lineMaturity ? dateToRuCyrillic(line.lineMaturity) : '—';
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : null;
  const penaltyPct = line?.penaltyRate != null ? Math.round(Number(line.penaltyRate) * 100) : null;

  const passport = [b?.passportSeries, b?.passportNumber ? `№${b.passportNumber}` : null].filter(Boolean).join(' ') || '—';
  const cols = c.collaterals ?? [];

  return {
    title: [
      { text: `№ ${lineAgreementNo(c)} СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ КЕЛИШУВ`, style: 'h1', alignment: 'center' },
    ],
    preamble: [
      p(
        `«${org?.tradeMark ?? '—'}» Савдо белгиси ${org?.nameUpper ?? '—'}, (бундан буён «ММТ»), деб ` +
        `номланувчи, Низом асосида фаолият юритувчи, ижрочи директори ${org?.directorShort ?? '—'} бир ` +
        `тарафдан, ва ўз номидан харакат қилувчи Ўзбекистон Республикаси фуқароси ${b?.fullName ?? '—'} ` +
        `(паспорт рақами ${passport}, ${b?.passportIssuer ?? '—'} томонидан ` +
        `${b?.passportIssueDate ? shortDate(b.passportIssueDate) : '—'} йилда берилган ), бундан буён ` +
        `«Қарз олувчи» бошқа тарафдан, биргаликда «Тарафлар», микромолия молия линиясини очиш бўйича ` +
        `қуйида шартлар асосида Бош келишувни туздилар:`,
      ),
    ],
    c11: [
      p(
        `1.1. ММТ мижозга ${moneyBare(amount)} сўм миқдорида ` +
        `${term != null ? `${term} (${wordsCyr(term)})` : '—'} ой муддатга, яъни ${startStr} дан ` +
        `${endStr} гача бўлган муддатга лимит билан микромолиялаш линиясини (бундан кейин ММЛ) очади ` +
        `ва ушбу келишувга шартларига асосан мижозга Микроқарз/микрокредитлар бериш мажбуриятини ` +
        `олади, мижоз эса олинган Микроқарз/микрокредитларни ММТ қайтариш ва улардан фойдаланганлик ` +
        `учун фоизларни тўлаш мажбуриятини олади.`,
      ),
    ],
    c24rate: [
      p(
        `2.4. Микроқарз/Микрокредит бўйича фоиз ставкаси асосий қарз бўйича йиллик – ` +
        `${ratePct != null ? `${ratePct}% (${wordsCyr(ratePct)})` : '—'} фоиз ва ` +
        `микроқарз/микрокредитнинг муддати ўтган асосий қарзи суммаси бўйича йиллик ` +
        `${penaltyPct != null ? `${penaltyPct}% (${wordsCyr(penaltyPct)})` : '—'} фоизни ташкил қилади . ` +
        `Фоизлар ҳар куни асосий қарзнинг жорий қолдиғига нисбатан йилига 365 (366) кун миқдорида ҳисобланади..`,
      ),
    ],
    // 3.1.1 — one paragraph per pledge. The sheet keeps a vehicle wording and a property wording in
    // two cells and a formula picks; here the collateral picks, and a case with both prints both.
    pledge: cols.length
      ? cols.map((col) => p(col.type === 'AUTO' ? autoPledge(col, c) : realtyPledge(col, c)))
      : [p('3.1.1. Гаров киритилмаган.')],
    insurance: insuranceClause(c, ins),
  };
}

/** 3.1.1 for a vehicle — the sheet's own A26, «бўлган бўлган» and all. */
function autoPledge(col: Collateral, c: CaseDocData): string {
  const pledgor = col.owners?.[0]?.fullName ?? c.borrower?.fullName ?? '—';
  return (
    `3.1.1. ${pledgor}  га тегишли бўлган бўлган, ранги -${dash(col.color)}, ишлаб чиқарилган йили -  ` +
    `${dash(col.year)}йил, кузов тури - ${dash(col.bodyType)}, кузов №${dash(col.bodyNo)}, двигатель ` +
    `№${dash(col.engineNo)}, шасси - ${dash(col.chassis)}, ${dash(col.model)} русумли автомашинаси ` +
    `(бундан кейин «Гаров предмети» гарови, Гаров предмети қиймати келишиш далолатномасига мувофиқ ` +
    `${moneyBare(col.agreedValue)} сўмни ташкил қилади. Гаров шартлари тегишли нотариал тасдиқланган ` +
    `гаров шартномаси билан белгиланади. Гаров предмети нинг нотариал тасдиқланган гаров шартномаси ` +
    `мижоз томонидан ушбу шартнома бўйича микрокредит беришдан олдин ММТга тақдим етилиши керак.\n` +
    `Гаров мулки суғурталанмайди.`
  );
}

/** 3.1.1 for property — the sheet's own F26 + G26, «ташки қилади» and all. */
function realtyPledge(col: Collateral, c: CaseDocData): string {
  const pledgor = col.owners?.[0]?.fullName ?? c.borrower?.fullName ?? '—';
  return (
    `3.1.1. ${pledgor} тегишли бўлган  ${dash(col.address)} манзилда жойлашган, умумий майдони - ` +
    `${dash(col.totalAreaM2)}, яшаш майдони - ${dash(col.livingAreaM2)} булган ${realtyWord(col)}  ` +
    `(бундан кейин – «Гаров Предмети») гарови, Гаров предмети қиймати келишиш далолатномасига асосан ` +
    `${moneyBare(col.agreedValue)}ни ташки қилади\n` +
    `Гаровнинг шартлари тегишли нотариал тасдиқланган гаров (ипотека) шартномаси билан белгиланади. ` +
    `"Гаров" нинг тегишли нотариал тасдиқланган гаров (ипотека) шартномаси қарз олувчи томонидан ушбу ` +
    `шартнома бўйича кредит беришдан олдин ММТ тақдим етилиши керак.\n` +
    `Гаров мулки суғурталанмайди.;`
  );
}

/**
 * 3.1.2 — the credit-risk policy.
 *
 * The sheet carries two wordings and a note to whoever fills it: «Если обеспечывается только
 * автомобилем полис скрыть» — hide the policy when a car is the only security. That note is an
 * instruction, not a clause, and is not printed; it is obeyed instead.
 *
 * With a named insurer the clause states it, with the general agreement it was issued under. With a
 * policy but no insurer named, the sheet's own generic wording stands.
 */
type Policy = NonNullable<NonNullable<CaseDocData['creditLine']>['insurance']>;
function insuranceClause(c: CaseDocData, ins: Policy | null | undefined): Content[] {
  if (!ins?.insured) return isAutoOnly(c) ? [] : [p(GENERIC_POLICY)];
  if (!ins.company) return [p(GENERIC_POLICY)];
  const signed = [
    ins.genAgreementDate ? `${dateToRuCyrillic(ins.genAgreementDate)}да` : null,
    ins.genAgreementNo ? `№${ins.genAgreementNo} сон билан` : null,
  ].filter(Boolean).join(' ');
  return [
    p(
      `3.1.2. Мазкур Келишув бўйича тузилган микроқарз/микрокредит шартномалари кредит рискларини ` +
      `суғурталаш полиси билан таъминланади, суғурта полиси ММТ ва ${ins.company} (бундан кейин - ` +
      `Суғурта компанияси) ўртасида кредит қайтмаслик хавфини суғурталаш бўйича ${signed || '—'} ` +
      `имзоланган Бош келишувга асосан Суғурта компанияси томонидан тақдим этилади. Суғурта суммаси ` +
      `ҳар бир аниқ ҳолатда, мижоз томонидан олинган микроқарз/микрокредит миқдоридан келиб чиққан ` +
      `ҳолда белгиланади.`,
    ),
  ];
}

/** The sheet's A27 — the wording used when no insurer is named. Its spelling is the sheet's. */
const GENERIC_POLICY =
  '3.1.2.Ушбу шартнома буйича тузилган микрокарз/микрокредит шартномаларига ММТ ни каноатлантирадиган ' +
  'хар кандай сугурта компанияси томонидан туланмаслик хавфи учун сугурта полиси илова килинади. ' +
  'Сугурта суммаси хар бир алохида холатда мижоз томонидан олинган микрокарз/микрокредит микдоридан ' +
  'келиб чикиб белгиланади.';

// ── requisites ───────────────────────────────────────────────────────────────

/** Article 7's two columns, from the Organization record and the case — never a frozen copy. */
function requisitesBlock(c: CaseDocData): Content {
  const org = c.organization;
  const b = c.borrower;
  const passportLine = [
    [b?.passportSeries, b?.passportNumber ? `№${b.passportNumber}` : null].filter(Boolean).join(' '),
    b?.passportIssuer ? `${b.passportIssuer} томонидан` : null,
    b?.passportIssueDate ? `${shortDate(b.passportIssueDate)} йилда берилган` : null,
  ].filter(Boolean).join(', ');
  const mmt: Content[] = [
    { text: '«Микромолия ташкилоти»', bold: true },
    { text: org?.nameUpper ?? '—', margin: [0, 4, 0, 2] },
    { text: `Манзил: ${org?.address ?? '—'}` },
    { text: `х/р: № ${org?.bankAccount ?? '—'}` },
    // The бош келишув writes the bank without «в» — the contract writes it with. Each as it reads.
    { text: `МФО: №${org?.bankMfo ?? '—'} ${org?.bankName ?? '—'}` },
    { text: `СТИР: ${org?.inn ?? '—'}` },
    ...(org?.phone ? [{ text: `Тел: ${org.phone}` }] : []),
    ...(org?.phone2 ? [{ text: org.phone2 }] : []),
    { text: 'Ижрочи директор', margin: [0, 14, 0, 2] },
    { text: org?.directorShort ?? '—' },
    { text: '\n___________________ (имзо)', margin: [0, 4, 0, 0] },
  ];
  const debtor: Content[] = [
    { text: '«Қарздор»', bold: true },
    { text: b?.fullName ?? '—', margin: [0, 4, 0, 2] },
    { text: `Манзил: ${borrowerAddress(b)}` },
    { text: passportLine || 'паспорт: —' },
    { text: `Тел: ${b?.phone ?? '—'}` },
    { text: b?.fullName ?? '—', margin: [0, 14, 0, 2] },
    { text: '\n___________________ (имзо)', margin: [0, 4, 0, 0] },
  ];
  return { columns: [{ width: '*', stack: mmt }, { width: '*', stack: debtor }], columnGap: 24, margin: [0, 6, 0, 0] };
}

/** The notarial attestation appended to the нотариал нусха variant. */
function notaryTail(c: CaseDocData): Content {
  const b = c.borrower;
  const passport = [b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—';
  return {
    stack: [
      { text: 'НОТАРИАЛ ТАСДИҚ', bold: true, alignment: 'center', margin: [0, 18, 0, 6] },
      { text: `Тарафлар шахси аниқланди: ${b?.fullName ?? '—'}, паспорт: ${passport}, ЖШШИР: ${b?.pinfl ?? '—'}, манзил: ${borrowerAddress(b)}.`, margin: [0, 2, 0, 6] },
      { text: 'Нотариус: ______________________________________', margin: [0, 4, 0, 2] },
      { text: 'Реестр рақами: _____________   Сана: _____________   Жой: _____________', margin: [0, 2, 0, 2] },
      { text: '\nНотариус имзоси ___________________     М.У. (муҳр)', margin: [0, 8, 0, 0] },
    ],
    margin: [0, 10, 0, 0],
  };
}
