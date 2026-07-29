/**
 * Uzbek (latin) number-to-words for monetary "prописью" fields on the
 * valuation act and generated PDFs. Replaces the Excel `n_1..n_5` / `тыс` /
 * `мил` named-range logic.
 *
 * Example: 84_000_000 → "sakson to'rt million so'm 00 tiyin"
 *
 * Lives in shared, not the backend, because the operator form fills the pledge
 * contract's «прописью» line as the figure is typed — it has to produce the same
 * wording the document will print, and two implementations would drift.
 */

const ONES = ['', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"];
const TENS = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"];
const SCALES = ['', 'ming', 'million', 'milliard', 'trillion'];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) {
    parts.push(ONES[hundreds], 'yuz');
  }
  const tens = Math.floor(rest / 10);
  const ones = rest % 10;
  if (tens > 0) parts.push(TENS[tens]);
  if (ones > 0) parts.push(ONES[ones]);
  return parts.filter(Boolean).join(' ');
}

/** Convert a non-negative integer to Uzbek words. */
export function integerToUzbekWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'nol';

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group === 0) continue;
    words.push(threeDigitsToWords(group));
    if (SCALES[i]) words.push(SCALES[i]);
  }
  return words.join(' ').trim();
}

/**
 * Format a sum as an Uzbek "prописью" string:
 * "<words> so'm <tiyin:00> tiyin".
 */
export function sumToWordsUz(amount: number): string {
  const soum = Math.floor(Math.abs(amount));
  const tiyin = Math.round((Math.abs(amount) - soum) * 100);
  const words = integerToUzbekWords(soum);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  const tiyinStr = String(tiyin).padStart(2, '0');
  return `${capitalized} so'm ${tiyinStr} tiyin`;
}

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** Format a date as Uzbek words, e.g. 2026-06-25 → "25 iyun 2026 yil" (UTC-based). */
export function dateToUzbekWords(d: Date): string {
  return `${d.getUTCDate()} ${UZ_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} yil`;
}

// ── Cyrillic variants for the generated documents ────────────────────────────
// The reference Excel forms are entirely in Uzbek Cyrillic with Russian month
// names ("Бир юз эллик миллион сўм 00 тийин", "14 Июль 2026 й."). The Latin
// helpers above stay for the web UI; documents use the Cyrillic ones below.

const ONES_CYR = ['', 'бир', 'икки', 'уч', 'тўрт', 'беш', 'олти', 'етти', 'саккиз', 'тўққиз'];
const TENS_CYR = ['', 'ўн', 'йигирма', 'ўттиз', 'қирқ', 'эллик', 'олтмиш', 'етмиш', 'саксон', 'тўқсон'];
const SCALES_CYR = ['', 'минг', 'миллион', 'миллиард', 'триллион'];

function threeDigitsToWordsCyr(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(ONES_CYR[hundreds], 'юз');
  const tens = Math.floor(rest / 10);
  const ones = rest % 10;
  if (tens > 0) parts.push(TENS_CYR[tens]);
  if (ones > 0) parts.push(ONES_CYR[ones]);
  return parts.filter(Boolean).join(' ');
}

/** Convert a non-negative integer to Uzbek Cyrillic words. */
export function integerToUzbekWordsCyrillic(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'нол';
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group === 0) continue;
    words.push(threeDigitsToWordsCyr(group));
    if (SCALES_CYR[i]) words.push(SCALES_CYR[i]);
  }
  return words.join(' ').trim();
}

/**
 * Format a sum as an Uzbek Cyrillic "прописью" string, matching the Excel forms:
 * 150_000_000 → "Бир юз эллик миллион сўм 00 тийин".
 */
export function sumToWordsUzCyrillic(amount: number): string {
  const soum = Math.floor(Math.abs(amount));
  const tiyin = Math.round((Math.abs(amount) - soum) * 100);
  const words = integerToUzbekWordsCyrillic(soum);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  const tiyinStr = String(tiyin).padStart(2, '0');
  return `${capitalized} сўм ${tiyinStr} тийин`;
}

/**
 * A money amount plus its Cyrillic words in parentheses, as the forms print it:
 * 150_000_000 → "150 000 000,00 (Бир юз эллик миллион сўм 00 тийин) сўм".
 */
export function moneyWithWordsCyr(amount: unknown): string {
  if (amount == null) return '—';
  const n = Number(amount); // accepts number or Prisma Decimal
  if (Number.isNaN(n)) return '—';
  // ru-RU groups with a (narrow) non-breaking space (\s matches both) — normalize to a plain space.
  const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 })
    .format(n)
    .replace(/\s/g, ' ');
  return `${formatted} (${sumToWordsUzCyrillic(n)}) сўм`;
}

// Russian month names (nominative), as the reference headers print them ("14 Июль 2026 й.").
const RU_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/**
 * Format a date as the forms print it, e.g. 2026-07-01 → "01 Июль 2026 й." (UTC-based).
 * The day is zero-padded to two digits, exactly as the reference Excel prints it.
 */
export function dateToRuCyrillic(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day} ${RU_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} й.`;
}
