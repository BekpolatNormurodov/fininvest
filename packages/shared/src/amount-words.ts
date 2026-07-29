/**
 * Sums written out in Uzbek Cyrillic — the «сумма прописью» line the pledge contract carries next
 * to the figure. The office types it by hand today, which is where the typos come from: the words
 * and the number have to agree, and only one of them is checked.
 *
 * Whole so'm only. Tiyin never appear on these contracts, and a fractional pledge value is a data
 * error rather than something to spell out, so the input is rounded before it is read.
 */

const ONES = ['', 'бир', 'икки', 'уч', 'тўрт', 'беш', 'олти', 'етти', 'саккиз', 'тўққиз'];
const TENS = ['', 'ўн', 'йигирма', 'ўттиз', 'қирқ', 'эллик', 'олтмиш', 'етмиш', 'саксон', 'тўқсон'];

/** Scale words. Uzbek has no plural agreement here — «икки миллион», not «икки миллионлар». */
const SCALES = ['', 'минг', 'миллион', 'миллиард', 'триллион'];

/** 0..999 in words. Returns '' for 0 so empty groups drop out of the final join. */
function underThousand(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) parts.push(`${ONES[h]} юз`);
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ONES[o]);
  return parts.join(' ');
}

/**
 * `29000000` → `йигирма тўққиз миллион сўм`.
 *
 * Returns '' for zero, negatives and anything non-finite: there is no sensible contract wording for
 * those, and an empty string leaves the operator's field blank rather than printing nonsense into a
 * document.
 */
export function amountInWords(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  const n = Math.round(value);
  if (n <= 0) return '';

  // Split into 3-digit groups, least-significant first, so the index IS the scale index.
  const groups: number[] = [];
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  if (groups.length > SCALES.length) return ''; // beyond триллион — not a real loan figure

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    words.push(underThousand(g));
    if (i > 0) words.push(SCALES[i]);
  }
  return `${words.join(' ')} сўм`;
}
