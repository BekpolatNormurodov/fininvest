import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUzCyrillic, dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { sectionTitle, shortDate, borrowerAddress } from '../doc-layout';
import { p, wordsCyr } from './_shared';
import { realtyWord } from './_collateral';
import { CONTRACT_LINES, type ContractSlot } from './contract-body';

/**
 * The asset-product contract — «договор узб» of «АВТО мфл APEX (2).xlsx».
 *
 * This is a DIFFERENT document from the cash contract in contract.ts, not a revision of it: the APEX
 * form has 14 articles where the cash form has 12, and a clause-by-clause comparison found 36 clauses
 * in the reference that the cash contract does not carry and 33 in the cash contract that the
 * reference does not. So the two live side by side, and the product picks:
 *
 *   AVTO / IPOTEKA  → here
 *   ADM TEAM / OSON → contract.ts, byte-for-byte as it was
 *
 * The static text comes from contract-body.ts, machine-copied from the sheet. This file only supplies
 * the ten places that carry the case, in the sheet's own wording — including its own spelling
 * («Сугурта», «фодаланиш», «сум») and its own uneven spacing, because the form is the agreed text.
 */
export function contractApexTemplate(c: CaseDocData): TDocumentDefinitions {
  const slots = buildSlots(c);
  const content: Content[] = [];

  for (const row of CONTRACT_LINES) {
    if (row.kind === 'heading') {
      // The requisites are the live organisation record, not the sheet's frozen copy of it — so the
      // body is rendered up to that heading and the two-column block takes over from there.
      if (row.text.startsWith('14.')) break;
      content.push(sectionTitle(row.text));
    } else if (row.kind === 'text') {
      content.push(p(row.text));
    } else {
      content.push(...slots[row.slot]);
    }
  }

  content.push(sectionTitle('14. Томонларнинг юридик манзиллари ва реквизитлари'));
  content.push(requisitesBlock(c));

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content,
    styles: { h1: { fontSize: 15, bold: true, margin: [0, 0, 0, 6] } },
  };
}

// ── slots ────────────────────────────────────────────────────────────────────

/**
 * "110 000 000,00 (Бир юз ўн миллион сўм 00 тийин)" — the amount and its words, WITHOUT the trailing
 * «сўм» that moneyWithWordsCyr adds. This sheet writes its own unit after the parenthesis («билан»,
 * «сум», «сўмни»), so the shared helper's suffix would double it.
 */
function moneyBare(amount: unknown): string {
  if (amount == null) return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(n).replace(/\s/g, ' ');
  return `${formatted} (${sumToWordsUzCyrillic(n)})`;
}

const dash = (v: unknown): string => (v == null || v === '' ? '—' : String(v));

function buildSlots(c: CaseDocData): Record<ContractSlot, Content[]> {
  const line = c.creditLine;
  const tr = line?.tranches?.[0];
  const b = c.borrower;
  const org = c.organization;
  const insurance = line?.insurance;

  const contractNo = c.contractNumber ?? c.number ?? '—';
  const lineDateStr = line?.lineDate ? dateToRuCyrillic(line.lineDate) : '—';
  // The sheet prints the maturity without the «й.» the start date carries — two different formula
  // cells, and this reproduces both rather than tidying one of them.
  const maturityStr = line?.lineMaturity ? dateToRuCyrillic(line.lineMaturity).replace(/ й\.$/, '') : '—';
  const applicationDateStr = tr?.applicationDate
    ? shortDate(tr.applicationDate)
    : line?.lineDate
      ? shortDate(line.lineDate)
      : '—';

  const amountTotal =
    line?.amountTotal != null ? Number(line.amountTotal)
      : tr?.principal != null ? Number(tr.principal)
        : c.amount != null ? Number(c.amount) : null;

  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : null;
  const penaltyPct = line?.penaltyRate != null ? Math.round(Number(line.penaltyRate) * 100) : null;

  const borrowerName = b?.fullName ?? '—';
  const passport = [b?.passportSeries, b?.passportNumber ? `№${b.passportNumber}` : null].filter(Boolean).join(' ') || '—';
  const passportIssuer = b?.passportIssuer ?? '—';
  const passportIssueDateStr = b?.passportIssueDate ? shortDate(b.passportIssueDate) : '—';

  const cols = c.collaterals ?? [];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type !== 'AUTO');
  const actNo = '1';

  const insuredSum = insurance?.insured && insurance.insuredSum != null ? Number(insurance.insuredSum) : null;
  const polisSum = insuredSum ?? (line?.amountPolis != null ? Number(line.amountPolis) : null);

  return {
    title: [
      { text: `Микрокредит шартномаси № ${contractNo}`, style: 'h1', alignment: 'center' },
    ],
    cityDate: [
      { columns: [{ text: 'Тошкент ш.' }, { text: lineDateStr, alignment: 'right' }], margin: [0, 0, 0, 10] },
    ],
    preamble: [
      p(
        `${org?.nameUpper ?? '—'}, бундан буён «Микромолия ташкилоти» деб номланувчи, Низом  асосида ` +
        `фаолият юритувчи, Ижрочи директор ${org?.directorShort ?? '—'} номидан бир томондан ва ўз ` +
        `манфаати йўлида ҳамда ўз номидан ҳаракат қилувчи Ўзбекистон Республикаси фуқароси ` +
        `${borrowerName}  (паспорт рақами ${passport}, ${passportIssuer} томонидан ` +
        `${passportIssueDateStr} йилда берилган ), бундан буён “Қарз олувчи” деб номланади,  бошқа ` +
        `томондан, биргаликда “Тарафлар” ёки алоҳида “Тараф” деб номланувчилар, Қарз олувчи ` +
        `томонидан ${applicationDateStr} йил, Микрокредит олиш учун ариза берилганлигини ҳисобга ` +
        `олиб, ушбу Микрокредит шартномасини (бундан кейин – «Шартнома») қуйидагилар ҳақида туздилар:`,
      ),
    ],
    c11: [
      p(
        `1.1. Микромолия ташкилоти Қарз олувчига ушбу Шартномада белгиланган шартлар асосида, ` +
        `Шартнома тузилган санадан бошлаб ${moneyBare(amountTotal)} билан Микрокредитни ` +
        `${lineDateStr} дан ${maturityStr} гача бўлган муддатга, Микрокредит (бундан буён матнда ` +
        `«кредит») тақдим этади, Қарз олувчи эса Микромолия ташкилотига олинган кредит суммасини ` +
        `қайтариш ҳамда унга ҳисобланган фоизларни тўлаш мажбуриятини олади.`,
      ),
    ],
    c24: [
      p(
        `2.4. Агар Қарз олувчи ушбу шартноманинг 1-иловасида кўрсатилган тўлов санасига қадар кредит ` +
        `бўйича асосий қарзни тўламаса, Микромолия ташкилоти муддати ўтган асосий қарз бўйича йиллик ` +
        `${penaltyPct != null ? penaltyPct + '%' : '—'} миқдорида фоизларни ундиради.`,
      ),
    ],
    c31: [
      p(
        `3.1. Микромолия ташкилоти кредит бўйича асосий қарзнинг фактик қолдиғига  йиллик ` +
        `${ratePct != null ? `${ratePct}% (${wordsCyr(ratePct)} %)` : '—'}  билан фоиз ҳисобидан ` +
        `фоизлар ҳисоблайди.`,
      ),
    ],
    // 3.1.1 carries the same number twice in the sheet on purpose: one paragraph for a vehicle, one
    // for property, and a formula picks. Here the collateral picks, and a case with both prints both.
    c311auto: autos.map((col) => p(auto311(col, borrowerName, lineDateStr, actNo))),
    c311realty: realty.map((col) => p(realty311(col, borrowerName, lineDateStr, actNo))),
    c411item: cols.length
      ? cols.map((col) => p(item411(col, lineDateStr, actNo)))
      : [p('- Гаров киритилмаган')],
    /*
      4.1.2 — the policy. On an asset case the premium is part of the deal, so the sum is taken from
      the insurance record when there is one and from the line's own полис amount when there is not.
      Only a case that carries neither says so plainly, rather than printing a sum of «—».
    */
    c412insurance: [
      p(
        polisSum != null
          ? `4.1.2  ${insurance?.company ?? '—'} суғурта компаниясининг кредит қайтмаслилиги хавфи ` +
            `полиси. Сугурта полисининг киймати ${moneyBare(polisSum)} сум. Тулик ` +
            `шартлари Сугурта компания ва Микромолия ташкилоти уртасида имзоланган келишувда ` +
            `курсатилиб утилган.`
          : '4.1.2  Кредит қайтмаслилиги хавфи полиси расмийлаштирилмаган.',
      ),
    ],
  };
}

type Collateral = CaseDocData['collaterals'][number];

/** 3.1.1 for a vehicle — the sheet's own row 24. */
function auto311(col: Collateral, borrower: string, actDate: string, actNo: string): string {
  const pledgor = col.owners?.[0]?.fullName ?? borrower;
  return (
    `3.1.1. Микромолия ташкилоти, ${pledgor}  томонидан  микромолия ташкилоти ва Қарздор томонидан ` +
    `${actDate}да имзоланган №${actNo} сонли Гаров предмети қийматини тасдиқлаш далолатномасига ` +
    `мувофиқ ${pledgor}га тегишли ${dash(col.year)} йил ишлаб чиқарилган, ранги - ${dash(col.color)}, ` +
    `двигатели рақами ${dash(col.engineNo)}, шасси - ${dash(col.chassis)},  кузов тури - ` +
    `${dash(col.bodyType)}, кузов №${dash(col.bodyNo)}, давлат рақам белгиси ${dash(col.stateNumber)} ` +
    `бўлган ${dash(col.model)} русумли автомашинаси (бундан кейин “Гаров предмети”)    ${pledgor}, ` +
    `ва келишилган гаров қиймати ${actDate}да имзоланган №${actNo}-сонли Гаров предмети қийматини ` +
    `тасдиқлаш далолатномасига мувофиқ ${moneyBare(col.agreedValue)} сум ташкил қилади. Гаровнинг ` +
    `аниқ шартлари тегишли тарзда  нотариал тасдиқланган гаров шартномаси билан белгиланади. `
  );
}

/** 3.1.1 for property — the sheet's own row 25, «фодаланиш» and all. */
function realty311(col: Collateral, borrower: string, actDate: string, actNo: string): string {
  const pledgor = col.owners?.[0]?.fullName ?? borrower;
  return (
    `3.1.1. Микромолия ташкилоти, ${pledgor}  томонидан  микромолия ташкилоти ва Қарздор томонидан ` +
    `${actDate}да имзоланган №${actNo} сонли Гаров предмети қийматини тасдиқлаш далолатномасига ` +
    `мувофиқ  ${dash(col.address)} манзилда жойлашган, умумий фодаланиш майдони - ` +
    `${dash(col.usableAreaM2)}, яшаш майдони - ${dash(col.livingAreaM2)}  бўлган ${realtyWord(col)}, ` +
    `(бундан кейин – «Гаров Предмети»)    ${pledgor} га тегишли ва келишилган гаров қиймати ` +
    `${actDate}даги №${actNo} гаров предмети қийматини тасдиқлаш далолатномасига мувофиқ ` +
    `${moneyBare(col.agreedValue)} сўмни ташкил қилади. Гаровнинг аниқ шартлари тегишли тарзда ` +
    `нотариал тасдиқланган ипотека шартномаси билан белгиланади.`
  );
}

/**
 * 4.1.1's list of what secures the credit — the sheet's own row 31.
 *
 * The sheet's cell also carries a parenthetical telling whoever fills the form whose names to write
 * («Микромолия ташкилоти, Қарз олувчи ва Гаров берувчининг номи — агар гаров берувчи учинчи шахс
 * бўлса»). That is an instruction to the operator, not a term of the contract, and it is not printed:
 * the names it asks for are already resolved here.
 */
function item411(col: Collateral, actDate: string, actNo: string): string {
  if (col.type === 'AUTO') {
    const reg = col.techPassportNo
      ? `${col.techPassportNo}${col.techPassportDate ? ` от ${shortDate(col.techPassportDate)} г.` : ''}`
      : '—';
    return (
      `- ${dash(col.model)} маркали транспорт воситаси гарови, ишлаб чиқарилган йили ${dash(col.year)}, ` +
      `ранги ${dash(col.color)}, двигатель рақами ${dash(col.engineNo)}, кузов ${dash(col.bodyNo)}, ` +
      `давлат рўйхатга олиш рақами ${reg}, бундан кейин «Гаров предмети» деб юритиладиган Эгасининг ` +
      `номига тегишли бўлган транспорт воситаси гарови, рўйхатга мувофиқ ва келишилган гаров қиймати ` +
      `${moneyBare(col.agreedValue)}, ${actDate} санасидаги №${actNo} рақамли гаров предмети ` +
      `қийматини келишиш далолатномасига мувофиқ.`
    );
  }
  return (
    `- ${dash(col.address)} манзилда жойлашган ${realtyWord(col)} гарови, умумий фодаланиш майдони - ` +
    `${dash(col.usableAreaM2)}, яшаш майдони - ${dash(col.livingAreaM2)}, кадастр рақами ` +
    `${dash(col.cadastreNo)}, бундан кейин «Гаров предмети» деб юритиладиган келишилган гаров қиймати ` +
    `${moneyBare(col.agreedValue)}, ${actDate} санасидаги №${actNo} рақамли гаров предмети қийматини ` +
    `келишиш далолатномасига мувофиқ.`
  );
}

// ── requisites ───────────────────────────────────────────────────────────────

/** Article 14's two columns, from the Organization record and the case — never a frozen copy. */
function requisitesBlock(c: CaseDocData): Content {
  const org = c.organization;
  const b = c.borrower;
  const passport = [b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—';
  const orgBankMfo = [org?.bankMfo ? `№${org.bankMfo}` : null, org?.bankName ? `в ${org.bankName}` : null]
    .filter(Boolean).join(' ') || '—';
  return {
    columns: [
      {
        width: '*',
        stack: [
          { text: '«Микромолия ташкилоти»', bold: true },
          { text: org?.nameUpper ?? '—', margin: [0, 4, 0, 2] },
          { text: `Манзил: ${org?.address ?? '—'}`, margin: [0, 1, 0, 1] },
          { text: `х/р: № ${org?.bankAccount ?? '—'}`, margin: [0, 1, 0, 1] },
          { text: `МФО: ${orgBankMfo}`, margin: [0, 1, 0, 1] },
          { text: `СТИР: ${org?.inn ?? '—'}`, margin: [0, 1, 0, 1] },
          ...(org?.phone ? [{ text: `Тел: ${org.phone}`, margin: [0, 1, 0, 1] as [number, number, number, number] }] : []),
          ...(org?.phone2 ? [{ text: org.phone2, margin: [0, 1, 0, 1] as [number, number, number, number] }] : []),
          { text: 'Ижрочи директор', margin: [0, 16, 0, 2] },
          { text: org?.directorShort ?? '—' },
          { text: '\n_______________ (imzo)', margin: [0, 4, 0, 0] },
        ],
      },
      {
        width: '*',
        stack: [
          { text: '«Қарз олувчи»', bold: true },
          { text: b?.fullName ?? '—', margin: [0, 4, 0, 2] },
          { text: `Манзил: ${borrowerAddress(b)}`, margin: [0, 1, 0, 1] },
          { text: `Паспорт: ${passport}`, margin: [0, 1, 0, 1] },
          { text: `ЖШШИР: ${b?.pinfl ?? '—'}`, margin: [0, 1, 0, 1] },
          { text: `Тел: ${b?.phone ?? '—'}`, margin: [0, 1, 0, 1] },
          { text: b?.fullName ?? '—', margin: [0, 10, 0, 2] },
          { text: '\n_______________ (imzo)', margin: [0, 4, 0, 0] },
        ],
      },
    ],
    columnGap: 24,
    margin: [0, 6, 0, 0],
  };
}

/** Every string the case supplies to the APEX body, keyed by slot. */
export type ApexSlots = Record<ContractSlot, Content[]>;
