import type { TexScanResult } from '@credit-core/shared';

/**
 * Parse an Uzbek vehicle-registration certificate (tex passport) from OCR text into AUTO-collateral
 * fields. Unlike the passport there is no MRZ, so the printed side carries numbered fields (1..19):
 *
 *   Front: 1 plate · 2 model · 3 colour · 4 owner · 5 address · 6 issue date · 7 issuer · 8 reg no
 *   Back:  9 year · 10 body type · 11 VIN/chassis · 12/13 weights · 14 engine no · 15..19 misc
 *
 * The certificate series (e.g. "VL8011449" / "AA9747835B") sits in a top corner and is not numbered,
 * so it is picked up by a token pattern. Everything here is best-effort OCR — no check digits.
 */

type TexFields = TexScanResult['fields'];

const emptyFields = (): TexFields => ({
  stateNumber: '', model: '', color: '', ownerName: '', address: '',
  techPassportDate: null, issuer: '', year: null, bodyType: '',
  bodyNo: '', chassis: '', engineNo: '', techPassportNo: '',
});

/** Collapse whitespace and trim. */
const squish = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Tex-passport text values are printed ALL-CAPS, but OCR reads the security-pattern background as
 *  lowercase word-junk right after the real value ("DAMAS wn ee yuri" / "YENGIL SEDAN iis Aa"). Keep
 *  the leading run of upper-case code tokens and stop at the first token that isn't one. */
const cleanPhrase = (s: string, max = 10): string => {
  const out: string[] = [];
  for (const t of s.split(/\s+/)) {
    if (!/^[A-Z0-9][A-Z0-9'.\-]*$/.test(t)) {
      if (out.length) break; // stop at the first lowercase/symbol token AFTER the value run
      continue;              // …but skip a leading OCR junk token (a stray "-", ".", "|") before it
    }
    out.push(t);
    if (out.length >= max) break;
  }
  return out.join(' ').trim();
};

/** Uppercase alphanumerics only (plate, VIN, engine no) — drops spaces, dots and stray punctuation. */
const alnum = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Real short tokens that must survive noise-stripping (neighbourhood/street abbreviations, house-no).
const KEEP_SHORT = new Set(['MFY', 'HFY', 'MSG', 'UY', 'IND', 'IOB', 'IIB', 'RO', 'VA', 'OQ']);
/** Drop leftover OCR noise from a free-text field: short junk tokens ("SEE", "SAS", "WU") go, while
 *  real words (≥4 letters), known abbreviations, and anything with a digit (house numbers) stay. */
const dropNoise = (s: string): string =>
  s.split(/\s+/)
    .filter((t) => { const w = t.replace(/[^A-Za-z']/g, ''); return /\d/.test(t) || w.length >= 4 || KEEP_SHORT.has(w.toUpperCase()); })
    .join(' ')
    .trim();

/** Join leading alnum tokens (code-like) up to `max` chars. OCR splits a plate/VIN/engine number with
 *  a space ("F8CB191 160056") and appends background garbage after it ("… RAGA POT"); this rejoins the
 *  real code and stops before the garbage by length. */
const joinCode = (s: string, max: number): string => {
  let out = '';
  for (const t of s.split(/\s+/)) {
    const a = alnum(t);
    if (!a) continue;
    if (out.length + a.length > max) break;
    out += a;
  }
  return out;
};

// Levenshtein edit distance — small strings only (single tokens).
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[m][n];
}

// Canonical Uzbek region + administrative terms printed in a tex-passport address/issuer. OCR reads
// them with letter swaps ("QASHQADARYO"→"KASHKADARYO", "VILOYATI"→"VILOYATT"); we snap each token to
// its canonical form when it's a close misread. Names/streets stay untouched (they match nothing).
const UZ_CANON = [
  "O'ZBEKISTON", 'QASHQADARYO', 'SURXONDARYO', 'ANDIJON', 'NAMANGAN', "FARG'ONA", 'SAMARQAND',
  'BUXORO', 'NAVOIY', 'JIZZAX', 'SIRDARYO', 'TOSHKENT', 'XORAZM', "QORAQALPOG'ISTON",
  'VILOYATI', 'TUMANI', 'SHAHRI', 'SHAHAR', "QISHLOG'I", "KO'CHASI", 'MAHALLASI',
];
// Letters only, upper-cased — apostrophes/case stripped, so misreads match regardless of punctuation.
const flatten = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, '');
type Canon = { canon: string; flat: string };
const toFlat = (list: string[]): Canon[] => list.map((c) => ({ canon: c, flat: flatten(c) }));
const UZ_FLAT = toFlat(UZ_CANON);
// Vehicle body types printed in field 10 ("kuzov turi") — a small closed set, so an OCR misread
// ("SEOAN", "UNVERSAL") snaps to the canonical spelling.
const BODY_FLAT = toFlat(['YENGIL', 'YUK', 'AVTOBUS', 'SEDAN', 'UNIVERSAL', 'XETCHBEK', 'MINIVEN', 'FURGON', 'SIDELKA', 'PIKAP', 'KUPE', 'MOTOTSIKL', 'TRAKTOR', 'PRITSEP']);
// Fuel / power type printed in field 16 ("yoqilg'i turi") — a small closed set.
const FUEL_FLAT = toFlat(['BENZIN', 'DIZEL', 'GAZ', 'METAN', 'PROPAN', 'ELEKTR', 'GIBRID', 'GBA']);

/** Snap a token to the closest canonical value (exact or close misread), else keep it as-is. */
function snapToken(tok: string, list: Canon[], minLen: number): string {
  const f = flatten(tok);
  if (f.length < minLen) return tok; // too short to correct safely
  let best = ''; let bestD = Infinity;
  for (const { canon, flat } of list) {
    if (Math.abs(flat.length - f.length) > 2) continue;
    const d = lev(f, flat);
    if (d < bestD) { bestD = d; best = canon; }
  }
  if (bestD === 0) return best;                      // exact — normalise apostrophes/case
  const limit = f.length >= 8 ? 2 : 1;               // longer tokens tolerate one more swap
  return bestD <= limit ? best : tok;
}

/** Correct region + administrative terms in a phrase (address / issuing office). Non-word tokens
 *  (house numbers like "23-UY", "IND") pass through unchanged. */
export function fixUzbekText(s: string): string {
  return s.split(/\s+/).map((t) => (/[A-Za-z]/.test(t) ? snapToken(t, UZ_FLAT, 5) : t)).join(' ').trim();
}

/**
 * Correct the vehicle body type (field 10) — snap "YENGIL SEOAN" → "YENGIL SEDAN" etc.
 *
 * A phrase in which nothing snapped to the closed set is not a body type. Field 10 is a small
 * fixed vocabulary printed on the form, so when the OCR box drifts onto a caption instead — «OLDI
 * KO'RINISH» — every token passes through unrecognised and the caption lands in the field, from
 * where it prints into «Кузов тури» on the приказ, the акт and the contract.
 *
 * Returning empty is the honest answer: the operator sees a blank to fill, not a plausible-looking
 * wrong value they have no reason to question.
 */
export function fixBodyType(s: string): string {
  const snapped = s.split(/\s+/).map((t) => (/[A-Za-z]/.test(t) ? snapToken(t, BODY_FLAT, 3) : t)).join(' ').trim();
  if (!snapped) return '';
  const known = new Set(BODY_FLAT.map((b) => b.canon));
  return snapped.split(/\s+/).some((t) => known.has(t)) ? snapped : '';
}

/**
 * Field 11's second half — the chassis, which on most Uzbek cars is printed as «RAKAMSIZ» (none).
 *
 * Anything else has to look like an identifier: letters and digits, no spaces. A phrase reaching
 * this field is the same OCR drift that fills the body type with a caption.
 */
export function cleanChassis(s: string): string {
  const v = s.trim();
  if (!v) return '';
  if (/^(RAKAMSIZ|РАКАМСИЗ|RAQAMSIZ)$/i.test(v)) return v.toUpperCase();
  return /^[A-Z0-9-]{4,20}$/i.test(v) ? v.toUpperCase() : '';
}

/** Correct the fuel/power type (field 16) — snap "BENZN" → "BENZIN", "DIZ EL" → "DIZEL". */
export function fixFuelType(s: string): string {
  return s.split(/\s+/).map((t) => (/[A-Za-z]/.test(t) ? snapToken(t, FUEL_FLAT, 3) : t)).join(' ').trim();
}

/** Merge the numbered fields from several OCR passes — per field keep the value with the most
 *  alphanumeric content. Different passes/thresholds recover different fields, so the union beats
 *  any single pass. */
export function mergeFields(maps: Array<Map<number, string>>): Map<number, string> {
  const out = new Map<number, string>();
  const score = (v: string) => (v.match(/[A-Za-z0-9]/g) || []).length;
  for (const m of maps) for (const [k, v] of m) {
    const cur = out.get(k);
    if (!cur || score(v) > score(cur)) out.set(k, v);
  }
  return out;
}

/** dd.mm.yyyy | dd/mm/yyyy | yyyy-mm-dd → ISO (yyyy-mm-dd), or null. */
export function texDateToIso(raw: string): string | null {
  const dmy = raw.match(/(\d{2})[.,\s\-/]+(\d{2})[.,\s\-/]+(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const ymd = raw.match(/(\d{4})[.,\s\-/]+(\d{2})[.,\s\-/]+(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return null;
}

/** A 4-digit manufacture year in a sane range, or null. */
function parseYear(raw: string): number | null {
  const m = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2100 ? y : null;
}

// A numbered field on a line: "N. value". OCR reads the card's security-pattern background as text,
// so the number is rarely at the line start (it gets garbage prefixed) and the dot is often a comma
// or colon. Match the number ANYWHERE on the line, and accept . , ) : as the separator.
const FIELD_LINE = /(?:^|[^\dA-Za-z])(\d{1,2})\s*[.,):]\s*(\S.+)$/;

/** Read numbered fields "N. value" out of OCR text into a map of number → value (first wins). A line
 *  with no number is a continuation of the current TEXT field (1..7) — owner/address wrap across lines
 *  — appended when it has letters (later cleanPhrase trims any background junk). */
export function numberedFields(text: string): Map<number, string> {
  const out = new Map<number, string>();
  let current: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(FIELD_LINE);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 19) { current = n; if (!out.has(n)) out.set(n, squish(m[2])); }
      else current = null;
    } else if (current != null && current <= 7 && /[A-Za-z]/.test(line)) {
      out.set(current, squish(`${out.get(current) ?? ''} ${line}`));
    }
  }
  return out;
}

/** Count numbered fields in OCR text — used to pick the best orientation. */
export function countFields(text: string): number {
  return numberedFields(text).size;
}

/** The certificate series/number, e.g. "VL8011449" or "AA9747835B" (2 letters + 6-9 digits + opt letter). */
export function findSeries(text: string): string {
  const m = text.toUpperCase().replace(/\s+/g, ' ').match(/\b([A-Z]{2}\s?\d{6,9}[A-Z]?)\b/);
  return m ? alnum(m[1]) : '';
}

/** A clean Uzbek plate anywhere on the front: 2 digits, a letter, 3 digits, 2 letters (70U922DB,
 *  10Z310GB). Only a clean match returns — a garbled OCR read stays empty rather than filling junk. */
export function findPlate(text: string): string {
  const m = text.toUpperCase().replace(/\s+/g, ' ').match(/\b(\d{2}\s?[A-Z]\s?\d{3}\s?[A-Z]{2})\b/);
  return m ? alnum(m[1]) : '';
}

/** Space a canonical plate for display: "10Z310GB" → "10 Z 310 GB". Non-matching input passes through. */
export function formatUzPlate(p: string): string {
  const m = p.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

/** A real VIN never contains I, O or Q (they'd be confused with 1/0/0), so OCR reading one of those
 *  is a misread — map it back. Only touch a 17-char VIN so a short/garbled read isn't altered. */
const normalizeVin = (s: string): string =>
  s.length === 17 ? s.replace(/I/g, '1').replace(/[OQ]/g, '0') : s;

/** Split field 11 "XWB7T12YDLP165062 / RAKAMSIZ" into { bodyNo, chassis }. */
function splitVin(raw: string): { bodyNo: string; chassis: string } {
  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean);
  const isNumberless = (s: string) => /RAKAMSIZ|РАКАМСИЗ|RAQAMSIZ/i.test(s);
  const body = parts.find((p) => !isNumberless(p)) ?? '';
  const chassisPart = parts.find((p) => isNumberless(p));
  return { bodyNo: joinCode(body, 17), chassis: chassisPart ? cleanChassis(squish(chassisPart)) : '' };
}

// Distinctive car-model words. When field 2 (model) reads garbage, the model word often still survives
// elsewhere on the front ("…OLET SPARK…"); this recovers it. The frontend snaps it to a full model.
const MODEL_HINTS = [
  'SPARK', 'NEXIA', 'DAMAS', 'MATIZ', 'COBALT', 'GENTRA', 'LACETTI', 'MALIBU', 'ONIX', 'TRACKER',
  'CAPTIVA', 'ORLANDO', 'EQUINOX', 'TRAILBLAZER', 'TRAVERSE', 'TAHOE', 'MONZA', 'LABO', 'TICO',
  'EPICA', 'AVEO', 'GRANTA', 'VESTA', 'LARGUS', 'PRIORA', 'CERATO', 'OPTIMA', 'SPORTAGE', 'SORENTO',
  'SELTOS', 'ACCENT', 'ELANTRA', 'SONATA', 'SOLARIS', 'CRETA', 'TUCSON', 'COROLLA', 'CAMRY',
  'FORTUNER', 'PRADO', 'TIGGO', 'ARRIZO', 'JOLION', 'COOLRAY', 'EMGRAND', 'MONJARO', 'ATLAS',
];

/** Find a known model word anywhere in the front OCR text (fallback when field 2 is garbled). */
export function findModelHint(frontText: string): string {
  const up = frontText.toUpperCase();
  return MODEL_HINTS.find((h) => new RegExp(`\\b${h}\\b`).test(up)) ?? '';
}

/**
 * Recover the owner's name when field 4 is garbled — anchor on the patronymic ("…OVICH" / "…O'G'LI" /
 * "…QIZI"), which OCR noise lacks, and take the two words before it (surname + first name). Digits are
 * stripped first so "1VAYADGAN" → "VAYADGAN". Empty if no patronymic is found.
 */
export function recoverOwner(frontText: string): string {
  const PAT = /(OVICH|EVICH|O'?G'?LI|QIZI|OVNA|EVNA)$/;
  const toks = frontText.toUpperCase().replace(/[^A-Z'ʻ ]/g, ' ').split(/\s+/).filter((t) => t.length >= 2);
  // The name is scattered across OCR passes; the patronymic appears several times with different
  // neighbours. Take EVERY patronymic occurrence's "2 words before + it" and keep the one carrying the
  // most letters (the fullest run — e.g. "SHAKIROV VAXABJAN TEMIROVICH" beats "VAYADGAN TEMIROVICH").
  const alpha = (s: string) => (s.match(/[A-Z]/g) ?? []).length;
  let best = '';
  for (let idx = 0; idx < toks.length; idx++) {
    if (toks[idx].length < 5 || !PAT.test(toks[idx])) continue;
    const run = toks.slice(Math.max(0, idx - 2), idx + 1).join(' ');
    if (alpha(run) > alpha(best)) best = run;
  }
  return best;
}

/**
 * Recover the owner's address when the "5." marker was lost — OCR often drops the dot ("5." → "5 "),
 * so the address bleeds into field 4 and field 5 reads noise. Anchor on "TUMANI"/"KO'CHASI"/"MAHALLASI"
 * (a district/street term the certificate's PRINTED viloyat-list lacks — so no false match from that
 * list) and take the words from just before it up to the house number "NN-UY". Empty if no anchor.
 */
export function recoverAddress(frontText: string): string {
  // Next-field labels / boilerplate — stop before spilling into them.
  const STOP = /^(BERILGAN|SANA|SANASI|DATE|ISSUE|ISSUING|VEHICLE|COLOUR|COLOR|OWNER|ADDRESS|NUMBER|AUTHORITY|IOB|IIB)/;
  const toks = frontText.toUpperCase().replace(/[^A-Z0-9'ʻ\- ]/g, ' ').split(/\s+/).filter(Boolean);
  const anchor = toks.findIndex((t) => /^(TUMAN|KO'?CHAS|KUCHAS|MAHALLA)/.test(t));
  if (anchor < 0) return '';
  const start = Math.max(0, anchor - 4);
  let end = anchor + 1;
  for (let i = anchor + 1; i < Math.min(toks.length, anchor + 7); i++) {
    if (STOP.test(toks[i])) break;             // don't spill into the next field's label
    end = i + 1;
    if (/^\d{1,3}-?UY$/.test(toks[i])) break;   // house number = natural end of the address
  }
  return toks.slice(start, end).filter((t) => t.length >= 2).join(' ');
}

/** Build the result from already-merged numbered fields (+ the raw texts, for the un-numbered series). */
export function extractTexFromFields(
  front: Map<number, string>, back: Map<number, string>, frontText: string, backText: string,
): TexScanResult {
  const f = emptyFields();

  // Only confident fields are emitted; a garbled read leaves the field empty for manual entry (better
  // than filling a wrong value). `letters()` requires the value to start with a letter — drops OCR
  // digit-junk like "00 BELODIMCHATIY" (OQ misread) or a numeric body-type.
  const letters = (s: string): string => (/^[A-Za-z]/.test(s) ? s : '');
  // OCR reads the very common white colour "OQ" as "00" / "0Q" / "O0" — fix that leading token.
  const fixColor = (s: string): string => s.replace(/^(00|0O|O0|0Q|Q0)\b/i, 'OQ');

  // Plate: ONLY a clean Uzbek plate-format match — no garbage fallback (was surfacing "EE" etc.).
  // Spaced for display: "10Z310GB" → "10 Z 310 GB".
  f.stateNumber = formatUzPlate(findPlate(frontText));
  // Model: ≥3 letters — every real model (DAMAS, SPARK, NEXIA, ONIX…) qualifies, but a 2-char OCR
  // misread ("RF") is dropped rather than surfaced as a wrong model.
  // Model: a KNOWN model word (from field 2's line or anywhere on the front) — DAMAS, SPARK, NEXIA…
  // A field-2 garbage read ("VOIY") is not a known model, so it's never emitted; unknown/unreadable
  // leaves the field empty for the operator to pick from the dropdown (safer than a wrong model).
  f.model = findModelHint(frontText);
  // Colour is 1–2 words (OQ · OQ BELIY · QORA · KULRANG); cap at 2 so a garbage tail ("OQ BELIY OAS")
  // from the security pattern is dropped.
  if (front.get(3)) f.color = letters(fixColor(cleanPhrase(front.get(3)!, 2)));
  if (front.get(4)) f.ownerName = letters(cleanPhrase(front.get(4)!));
  // If the name doesn't end in a patronymic (field 4 was garbled), recover a patronymic-anchored name.
  if (!/(OVICH|EVICH|O'?G'?LI|QIZI|OVNA|EVNA)$/.test((f.ownerName.split(' ').pop() ?? ''))) {
    const rec = recoverOwner(frontText);
    if (rec) f.ownerName = rec;
  }
  // Address + issuer carry region/administrative terms — snap their OCR misreads to canonical Uzbek.
  if (front.get(5)) f.address = fixUzbekText(letters(cleanPhrase(front.get(5)!, 14)));
  // If the "5." marker was lost (address bled into field 4 → field 5 empty/noise), recover it.
  if (!f.address) f.address = fixUzbekText(recoverAddress(frontText));
  if (front.get(6)) f.techPassportDate = texDateToIso(front.get(6)!);
  if (front.get(7)) f.issuer = fixUzbekText(letters(cleanPhrase(front.get(7)!)));
  // Strip leftover OCR noise from the free-text fields so a degraded scan shows the real words
  // ("SEE VAYADGAN TEMIROVICH" → "VAYADGAN TEMIROVICH", "TOSHKENT OYA SS" → "TOSHKENT").
  f.ownerName = dropNoise(f.ownerName);
  f.address = dropNoise(f.address);
  f.issuer = dropNoise(f.issuer);
  // The issuing office is always "<region> VILOYATI/SHAHRI … RO' VA IOB" — if the read carries no
  // region or admin anchor, it's OCR noise ("GERI", "TOSH SARIN"), so drop it rather than show garbage.
  if (f.issuer && !/VILOYAT|SHAHR|SHAHAR|\bIOB\b|\bIIB\b|QASHQADARYO|SURXONDARYO|ANDIJON|NAMANGAN|FARG|SAMARQAND|BUXORO|NAVOIY|JIZZAX|SIRDARYO|TOSHKENT|XORAZM|QORAQALPOG/i.test(f.issuer)) f.issuer = '';

  // Year: field 9, or field 8 (a common "9"→"8" OCR misread), or the smallest standalone year in the
  // back text (manufacture year is older than the inspection date, e.g. 2019 vs 2025-11-05).
  f.year = parseYear(back.get(9) ?? '') ?? parseYear(back.get(8) ?? '') ?? (() => {
    const years = (backText.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number).filter((y) => y >= 1980 && y <= 2035);
    return years.length ? Math.min(...years) : null;
  })();
  if (back.get(10)) f.bodyType = fixBodyType(letters(cleanPhrase(back.get(10)!, 3)));
  // VIN only when it's a full-length code (≥11); a short/garbled read is dropped.
  if (back.get(11)) { const v = splitVin(back.get(11)!); const vin = normalizeVin(v.bodyNo); if (vin.length >= 11) f.bodyNo = vin; f.chassis = v.chassis; }
  // Engine only when it's a reasonable code length (≥8).
  if (back.get(14)) { const e = joinCode(back.get(14)!, 15); if (e.length >= 8) f.engineNo = e; }

  // Series is not numbered — search the back first (it prints there), then the front.
  f.techPassportNo = findSeries(backText) || findSeries(frontText);

  // Confidence = share of the key vehicle fields that came through. (Weights/reg-no are informational
  // and NOT counted — they don't affect the collateral, so they must not inflate the score.)
  const key = [f.stateNumber, f.model, f.year != null ? 'y' : '', f.bodyNo, f.engineNo, f.color];
  const got = key.filter(Boolean).length;
  const confidence = Math.round((got / key.length) * 100);

  // Informational fields shown in the scan review but NOT stored on the collateral (no such field):
  // registration number (8) and the two weights (12 full, 13 unladen) — "1 310.00 (KG)" → "1310 kg".
  const digitsOf = (raw?: string): string => (raw ?? '').split(/[.,(]/)[0].replace(/[^\d]/g, '');
  const weight = (raw?: string): string => { const n = digitsOf(raw); return n ? `${Number(n)} kg` : ''; };
  const info: Array<{ key: string; value: string }> = [];
  const regNo = digitsOf(back.get(8));
  if (regNo.length >= 6) info.push({ key: 'regNumber', value: regNo });
  const fullW = weight(back.get(12)); if (fullW) info.push({ key: 'fullWeight', value: fullW });
  const unladenW = weight(back.get(13)); if (unladenW) info.push({ key: 'unladenWeight', value: unladenW });
  const fuel = back.get(16) ? fixFuelType(letters(cleanPhrase(back.get(16)!, 2))) : ''; // 16 = yoqilg'i turi
  if (fuel) info.push({ key: 'fuelType', value: fuel });

  const perField = [
    ...Object.entries(f).filter(([, v]) => v !== '' && v != null).map(([k, v]) => ({ key: k, value: String(v) })),
    ...info,
  ];

  const warnings: string[] = [];
  if (got === 0) warnings.push('tex_not_found');
  else if (confidence < 50) warnings.push('low_confidence');
  if (!back.size) warnings.push('back_not_found');

  return { confidence, fields: f, perField, warnings };
}

/** Parse a tex passport's front + back OCR text into the collateral fields + a confidence score. */
export function extractTexFields(frontText: string, backText: string): TexScanResult {
  return extractTexFromFields(numberedFields(frontText), numberedFields(backText), frontText, backText);
}
