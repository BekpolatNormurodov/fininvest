import type { Content } from 'pdfmake/interfaces';
import {
  sumToWordsUz, dateToUzbekWords, moneyWithWordsCyr, integerToUzbekWordsCyrillic,
} from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { borrowerAddress } from '../doc-layout';

/** Justified body paragraph. */
export const p = (text: string): Content => ({ text, margin: [0, 3, 0, 3], alignment: 'justify' });

/** Marks a merged case value so `pv` can set it in bold. */
export const v = (value: unknown): { v: string } => ({ v: value == null || value === '' ? '—' : String(value) });

/**
 * Justified paragraph in which the merged case data is bold, so the filled-in values stand out from
 * the boilerplate. Pass alternating static text and `v(...)` values:
 *
 *   pv('Мен, ', v(director), ' , фуқаро ', v(name), 'нинг иштирокида …')
 */
export const pv = (...parts: (string | { v: string })[]): Content => ({
  text: parts.map((x) => (typeof x === 'string' ? x : { text: x.v, bold: true })),
  margin: [0, 3, 0, 3],
  alignment: 'justify',
});

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Number in Cyrillic Uzbek words, capitalized (e.g. 55 → "Эллик беш"). */
export const wordsCyr = (n: number): string => cap(integerToUzbekWordsCyrillic(n));

/**
 * "Микроқарз" or "Микрокредит" — the reference workbooks swap this word throughout a form depending
 * on the product: the microloan book prints «Микроқарз олиш учун», the microcredit book prints
 * «Микрокредит олиш учун». Driven by the stored loanType, falling back to the 100 mln threshold.
 */
export function loanWord(c: CaseDocData): string {
  const lt = c.creditLine?.loanType;
  if (lt === 'MICROCREDIT') return 'Микрокредит';
  if (lt === 'MICROLOAN') return 'Микроқарз';
  const amount = Number(c.creditLine?.amountTotal ?? c.amount ?? 0);
  return amount > 100_000_000 ? 'Микрокредит' : 'Микроқарз';
}

/**
 * What the client does for a living — Д1!C36, the cell «Фаолият жойи» / «Фаолият тури» /
 * «Асосий фаолият жойи» all read.
 *
 * «оз озини банд колган дб кириткканмиз шуни тортиш кере» — a client entered as self-employed
 * («O'Z O'ZINI BAND QILGAN №12588») did not come through. Three documents each answered this
 * differently: the анкета printed the employer and nothing else, so a self-employed client got «—»;
 * the score report preferred the certificate; the credit application preferred the employer with
 * `??`, so an employer stored as '' hid the certificate behind it. One cell, three answers.
 *
 * The certificate wins where it exists — the score report's existing rule, and the reason it has
 * one: a registered sole trader's status IS the answer, and the workplace stands in when there is
 * none. `||` throughout, so a blank falls through instead of ending the chain.
 */
export function activityLine(c: CaseDocData): string {
  const cert = [c.borrower?.entrepreneurType, c.borrower?.entrepreneurCertNo]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .join(' № ');
  return cert || c.employment?.employer?.trim() || '—';
}

/** "200 000 000,00 (ikki yuz million ...)" — number + words. */
export function amountWords(amount: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(amount)},00 (${amount ? sumToWordsUz(amount) : '—'})`;
}

/** The shared numbered line terms (form, limit, term, rate/penalty) — identical across the forms. */
export function lineTerms(c: CaseDocData): Content[] {
  const line = c.creditLine;
  const amount = line?.amountTotal ?? c.amount ?? null;
  const term = line?.termMonths ?? null;
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : null;
  const penaltyPct = line?.penaltyRate != null ? Math.round(Number(line.penaltyRate) * 100) : 105;
  const termText = term != null ? `${term} (${wordsCyr(term)}) ой` : '—';
  const rateText = ratePct != null ? `${ratePct}% (${wordsCyr(ratePct)}) фоиз` : '—';
  const penaltyText = `${penaltyPct}% (${wordsCyr(penaltyPct)}) фоиз`;
  return [
    p('1. Микромолия линияси доирасида ажратиладиган Микроқарз/микрокредит шакли: нақд ёки пул ўтказиш йўли билан (Мижоз ихтиёрига кўра);'),
    p(`2. Микромолия линия лимит суммаси: ${moneyWithWordsCyr(amount)}гача;`),
    p(`3. Микромолия линия муддати: ${termText};`),
    p(`4. Микромолия линияси доирасида ажратиладиган микроқарз/микрокредитларнинг фоиз ставкаси: йиллик ${rateText}дан кредит миқдорининг қолдиқ суммасига нисбатан хисобланади. Тўлаш жадвалига мувофиқ асосий қарз бўйича навбатдаги тўлов бузилган ҳолларда муддати ўтган микроқарз/микрокредитнинг асосий қарз суммаси бўйича йиллик ${penaltyText} миқдорида фоизлар ҳисоблайди.`),
  ];
}

/** The notarial-attestation block appended to notary-variant documents (party ID + fill-in lines). */
export function notaryBlock(c: CaseDocData): Content {
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

/** Per-collateral details block (auto or real estate), verbatim style. */
export function collateralDetails(c: CaseDocData): Content[] {
  const b = c.borrower;
  const out: Content[] = [];
  for (const col of c.collaterals) {
    const owner = col.owners?.[0]?.fullName ?? b?.fullName ?? '—';
    if (col.type === 'AUTO') {
      out.push(p(`Мулк номи: ${col.model ?? '—'}`));
      out.push({ text: `* Автомототранспорт воситаси эгаси: ${owner}`, margin: [0, 1, 0, 1] });
      out.push({ text: `* техник паспорт рақами: ${[col.techPassportNo, col.techPassportDate ? dateToUzbekWords(col.techPassportDate) : null].filter(Boolean).join(' от ') || '—'}`, margin: [0, 1, 0, 1] });
      out.push({ text: `* давлат рақами: ${col.stateNumber ?? '—'}`, margin: [0, 1, 0, 1] });
    } else {
      out.push(p(`Ушбу ${col.realtyKind === 'HOUSE' ? 'ҲОВЛИ' : 'кўчмас мулк'} объектнинг таркиби ва таснифи:`));
      out.push({ text: `Хоналар сони: ${col.roomCount ?? '—'} та, умумий майдони ${col.totalAreaM2 ?? '—'} кв.м., яшаш майдони - ${col.livingAreaM2 ?? '—'} кв.м.${col.roomNames ? ', хоналар номи: ' + col.roomNames : ''}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* кўчмас мулк эгаси: ${owner}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* реестр рақами: ${col.registryNo ?? '—'}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* кадастр рақами: ${col.cadastreNo ?? '—'}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* манзил: ${col.address ?? '—'}`, margin: [0, 1, 0, 1] });
    }
  }
  return out;
}
