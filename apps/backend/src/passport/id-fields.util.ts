/** Pure extractors for Uzbek ID cards — label-anchored OCR of the printed (VIZ) text. */
import type { PassportScanResult } from '@credit-core/shared';

export interface IdFrontFields {
  fullName: string;
  issueDate: string | null;
  nationality: string;
  birthDate: string | null;
  expiryDate: string | null;
  cardNumber: string;
}

export interface IdBackViz {
  placeOfBirth: string;
  issuer: string;
}

/** "21.01.2025" / "15 06 2017" / "07,03.2024" → ISO at UTC midnight, or null. Separators are OCR-noisy
 *  (a printed dot reads as '.', ',', ' ', '-', '/' or a stray combination), so accept any run of them. */
export function ddmmyyyyToIso(s: string | null | undefined): string | null {
  const m = (s ?? '').match(/(\d{2})[.,\s\-/]+(\d{2})[.,\s\-/]+(\d{4})/);
  if (!m) return null;
  const dd = +m[1], mm = +m[2], yyyy = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd)).toISOString();
}

const NAME = /^[A-Z][A-Z'`‘’-]{3,29}$/; // a single uppercase name token (≥4 chars, drops OCR noise)
// Header/label words that are all-caps and could be mistaken for a name when the OCR is noisy (e.g.
// the "GUVOHNOMASI" anchor is unreadable). Compared apostrophe-stripped, uppercased.
const NAME_STOP = new Set([
  'OZBEKISTON', 'OZBEKISTAN', 'RESPUBLIKASI', 'RESPUBLIKA', 'RESPUBLIKAS', 'SHAXS', 'GUVOHNOMASI',
  'GUVOHNOMAS', 'REPUBLIC', 'UZBEKISTAN', 'IDENTITY', 'CARD',
  'FAMILIYASI', 'SURNAME', 'ISMI', 'GIVEN', 'NAME', 'NAMES', 'OTASINING', 'PATRONYMIC', 'TUGILGAN',
  'SANASI', 'DATE', 'BIRTH', 'JINSI', 'SEX', 'ERKAK', 'AYOL', 'BERILGAN', 'ISSUE', 'FUQAROLIGI',
  'CITIZENSHIP', 'AMAL', 'MUDDATI', 'EXPIRY', 'KARTA', 'RAQAMI', 'NUMBER', 'IMZOSI', 'SIGNATURE',
]);

/** Lines with whitespace collapsed; blank lines dropped. */
function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Index of the first line whose UPPERCASE contains any keyword; -1 if none. */
function labelIdx(ls: string[], keywords: string[]): number {
  const up = ls.map((l) => l.toUpperCase());
  for (let i = 0; i < up.length; i++) if (keywords.some((k) => up[i].includes(k))) return i;
  return -1;
}

/** The first following token (after the label line) matching `ok`, within `span` lines. */
function valueAfter(ls: string[], keywords: string[], ok: (s: string) => boolean, span = 2): string {
  const i = labelIdx(ls, keywords);
  if (i < 0) return '';
  for (let j = i + 1; j <= i + span && j < ls.length; j++) {
    for (const tok of ls[j].split(' ')) if (ok(tok)) return tok;
  }
  return '';
}

/** First dd.mm.yyyy on/after a label line. */
function dateAfter(ls: string[], keywords: string[], span = 2): string | null {
  const i = labelIdx(ls, keywords);
  if (i < 0) return null;
  for (let j = i; j <= i + span && j < ls.length; j++) {
    const iso = ddmmyyyyToIso(ls[j]);
    if (iso) return iso;
  }
  return null;
}

/**
 * Extract surname / given / patronymic. The bilingual labels ("Familiyasi / Surname") OCR poorly
 * (some drop out entirely), so instead exploit the layout: the three NAME values sit between the
 * "GUVOHNOMASI" header and the "Date of birth" row, each on its own line, and — unlike the label
 * lines — a value line has no "/" or "|" separator. From each such line take the longest all-caps
 * token (≥4 chars, drops noise like "EER"/label words). Returns up to three names in order.
 */
function extractNames(ls: string[]): string[] {
  const upper = ls.map((l) => l.toUpperCase());
  const start = upper.findIndex((l) => l.includes('GUVOHNOMASI') || l.includes('IDENTITY'));
  const from = start >= 0 ? start + 1 : 0;
  let end = upper.findIndex((l, i) => i >= from && (l.includes('DATE OF BIRTH') || l.includes('TUGILGAN SANASI')));
  if (end < 0) end = ls.length;
  const names: string[] = [];
  for (let i = from; i < end && names.length < 3; i++) {
    // Skip a bilingual label line ("Familiyasi / Surname") by its '/' separator. NOT '|': OCR often
    // sprinkles a stray '|' at the start of a VALUE line ("| ¥3 TASKAROV 25"), and dropping those
    // lost the surname entirely. Label WORDS are filtered by NAME_STOP below regardless.
    if (ls[i].includes('/')) continue;
    const toks = ls[i]
      .split(' ')
      .filter((t) => NAME.test(t) && !NAME_STOP.has(t.replace(/['`‘’]/g, '')))
      .sort((a, b) => b.length - a.length);
    if (toks.length) names.push(toks[0]);
  }
  return names;
}

export function extractIdFront(text: string): IdFrontFields {
  const ls = lines(text);
  const fullName = extractNames(ls).join(' ');
  const cardNumber = valueAfter(ls, ['CARD NUMBER', 'KARTA RAQAMI'], (t) => /^[A-Z]{2}\d{7}$/.test(t));
  return {
    fullName,
    issueDate: dateAfter(ls, ['DATE OF ISSUE', 'BERILGAN SANASI']),
    nationality: valueAfter(ls, ['CITIZENSHIP', 'FUQAROLIGI'], (t) => /ZBEKISTON/.test(t.toUpperCase())),
    birthDate: dateAfter(ls, ['DATE OF BIRTH', 'TUGILGAN SANASI']),
    expiryDate: dateAfter(ls, ['DATE OF EXPIRY', 'AMAL QILISH']),
    cardNumber,
  };
}

/** Keep only ALL-CAPS words of ≥3 letters, dropping mixed-case noise, punctuation, short all-caps
 *  junk ("QF"), and header/label/country words ("O'ZBEKISTON", "RESPUBLIKASI" — which otherwise
 *  bleed into a place/authority phrase): "QF ZAFAROBOD TUMANI O'ZBEKISTON" → "ZAFAROBOD TUMANI".
 *  Real place/authority words (ZAFAROBOD, TUMANI, VILOYATI, IIB, IIV) survive. */
function capsPhrase(s: string): string {
  return s
    .split(/\s+/)
    // Strip digits/punctuation clinging to a token so OCR noise doesn't kill a real word:
    // "TUMAN!" → "TUMAN", "264508" → "" (dropped). Apostrophes (QORAKO'L) are kept.
    .map((t) => t.replace(/[^A-Za-z'`‘’]/g, ''))
    .filter((t) => /^[A-Z][A-Z'`‘’]{2,}$/.test(t) && !NAME_STOP.has(t.replace(/['`‘’]/g, '')))
    .join(' ');
}

export function extractIdBackViz(text: string): IdBackViz {
  const ls = lines(text);
  const after = (kw: string[]) => {
    const i = labelIdx(ls, kw);
    return i >= 0 && i + 1 < ls.length ? ls[i + 1] : '';
  };
  // Anchor on the single stable label word — "of birth" OCRs as "ofvbirth", "Place" as "Plage" —
  // so match just BIRTH / ISSUE (the back has no other such rows). If the label is too garbled,
  // fall back to the line carrying an Uzbek place suffix (…TUMANI / SHAHRI / VILOYATI).
  let placeOfBirth = capsPhrase(after(['BIRTH', 'TUGILGAN']));
  if (!placeOfBirth) {
    const suffix = /(TUMANI|TUMAN|SHAHRI|SHAHAR|VILOYATI|QISHLOG)/;
    for (const l of ls) {
      const c = capsPhrase(l);
      if (suffix.test(c)) { placeOfBirth = c; break; }
    }
  }
  // Issuer looks like "IIV 6230" (agency code + number). UZ codes are IIV / IIB, but OCR mangles the
  // letters (IIV→HV/NV, II→H). Take the code+number from the issue line and normalize by the trailing
  // agency letter: V → IIV, B → IIB. No code+number at all → blank rather than garbage.
  const m = after(['ISSUE', 'BERILGAN']).toUpperCase().match(/([A-Z]{1,4})\s?(\d{3,5})/);
  let issuer = '';
  if (m) {
    // UZ ID authorities are always IIV (…IIV) or district IIB. OCR mangles the letters (IIV→HV/PY/NV),
    // so normalize the code to IIV, or IIB when it ends in B. Keeps the (unverified) office number.
    const code = m[1].endsWith('B') ? 'IIB' : 'IIV';
    issuer = `${code} ${m[2]}`;
  }
  return { placeOfBirth, issuer };
}

/**
 * Reconcile a leading OCR-noise glyph on the surname. The card's left border is frequently misread as
 * an extra leading letter before the surname on BOTH the MRZ and the front — e.g. the real surname
 * "ASKAROV" reads as MRZ "VASKAROV" and front "TASKAROV". When the two independent sources disagree
 * on the leading char but share a ≥5-char suffix, that shared suffix is the true surname. Returns the
 * corrected surname, or null when there is nothing to reconcile.
 */
function reconcileSurname(a: string, b: string): string | null {
  if (!a || !b || a === b) return null;
  const ta = a.slice(1), tb = b.slice(1);
  if (ta === b && b.length >= 5) return b; // a carries an extra leading char
  if (tb === a && a.length >= 5) return a; // b carries an extra leading char
  if (ta === tb && ta.length >= 5) return ta; // both carry an extra leading char
  return null;
}

/**
 * Merge the check-digit-verified back MRZ with OCR'd front/back text. MRZ wins for the verified
 * numbers; name + issue date + place of birth/issue come from OCR and are named in
 * `unverifiedFields`. A front/back date disagreement adds a `front_back_mismatch` warning.
 */
export function mergeIdResult(back: PassportScanResult, front: IdFrontFields, viz: IdBackViz): PassportScanResult {
  const unverified: string[] = [];
  const fields = { ...back.fields }; // starts with the MRZ name (surname + given)
  // Two name sources: the MRZ (surname+given) and the front VIZ (adds the patronymic). Either can be
  // garbled on a small/blurry card, and on a glare/wrinkled laminate the front OCR can be pure noise
  // (e.g. "ASKAROV MUXTOR" reading as "TASKAROV STOR"). Use the front only when its surname AGREES
  // with the MRZ (contains the other, tolerating OCR noise) — the reliable, richer case that adds the
  // patronymic — OR when the MRZ gave no usable surname (nothing better to fall back to). A front name
  // that DISAGREES with a present MRZ surname is treated as OCR garbage and dropped in favour of the
  // structured, partially check-digit-verified MRZ name — never surfaced just because confidence < 90.
  const mrzSurname = (back.fields.fullName || '').split(' ')[0] || '';
  const frontSurname = (front.fullName || '').split(' ')[0] || '';
  const agree =
    frontSurname.length >= 4 &&
    mrzSurname.length >= 4 &&
    (mrzSurname === frontSurname || mrzSurname.includes(frontSurname) || frontSurname.includes(mrzSurname));
  let chosenName = front.fullName && (agree || !mrzSurname) ? front.fullName : back.fields.fullName;
  // Strip a leading OCR-noise glyph from the surname when front and MRZ corroborate the true core
  // (e.g. MRZ "VASKAROV" + front "TASKAROV" → "ASKAROV").
  const fixedSurname = reconcileSurname(mrzSurname, frontSurname);
  if (fixedSurname && chosenName) {
    const toks = chosenName.split(' ');
    if (toks[0] === mrzSurname || toks[0] === frontSurname) { toks[0] = fixedSurname; chosenName = toks.join(' '); }
  }
  if (chosenName) { fields.fullName = chosenName; unverified.push('fullName'); }
  if (viz.placeOfBirth) { fields.placeOfBirth = viz.placeOfBirth; unverified.push('placeOfBirth'); }
  /*
    These two are always present on an ID result, empty included.

    Neither is in the MRZ — ICAO 9303 has no issuing authority and no date of issue — so both come
    from OCR of the printed text and both can come back empty. Omitting the key when that happens
    hid the row entirely: the form renders on `!== undefined`, so the operator saw no field, could
    not tell the scan had missed anything, and had nowhere to type what the card plainly says.

    Only a value that was actually read is marked unverified; an empty one is a blank to fill, not
    something the scan claims to have seen.
  */
  fields.passportIssueDate = front.issueDate ?? null;
  fields.passportIssuer = viz.issuer || '';
  if (front.issueDate) unverified.push('passportIssueDate');
  if (viz.issuer) unverified.push('passportIssuer');
  const warnings = [...back.warnings];
  const mismatch = (a: string | null | undefined, b: string | null) => !!a && !!b && a !== b;
  if (mismatch(front.birthDate, back.fields.birthDate) || mismatch(front.expiryDate, back.fields.passportExpiry)) {
    if (!warnings.includes('front_back_mismatch')) warnings.push('front_back_mismatch');
  }
  return { ...back, fields, warnings, docType: 'ID', unverifiedFields: unverified };
}

export interface PassportViz {
  placeOfBirth: string;
  issueDate: string | null;
  issuer: string;
}

/**
 * Passport visible page (VIZ) — the MRZ carries none of these, so read them from the printed fields:
 * place of birth, date of issue, and the issuing authority. All are OCR (no check digit) → the
 * caller flags them unverified.
 */
export function extractPassportViz(text: string): PassportViz {
  const ls = lines(text);
  // Place of birth: the first line carrying an Uzbek place suffix (…TUMANI/SHAHRI/VILOYATI). It
  // prints above the issuer authority, so first-match wins (digits/labels are dropped by capsPhrase).
  const suffix = /(TUMANI|TUMAN|SHAHRI|SHAHAR|VILOYATI|QISHLOG)/;
  let placeOfBirth = '';
  for (const l of ls) { const c = capsPhrase(l); if (suffix.test(c)) { placeOfBirth = c; break; } }
  // Issuer: the authority after "KIM TOMONIDAN BERILGAN" / "ORGANI" / "AUTHORITY", spanning up to two
  // lines (e.g. "BUXORO VILOYATI QORAKUL TUMANI IIB"). Best-effort; flagged unverified.
  const ai = labelIdx(ls, ['TOMONIDAN', 'ORGANI', 'AUTHOR']);
  /*
    The authority ends at its office suffix (…IIB / …IIV), and that suffix is now required rather
    than used to trim.

    The label match is not safe on its own. The same page carries «PERSONALLASHTIRISH ORGANI /
    AUTHORITY», which answers to both 'ORGANI' and 'AUTHOR'; one bad character in TOMONIDAN is
    enough to pick it, and what followed went out as the issuer. That string reaches the contract —
    «… томонидан … берилган» — so a misread put an authority on a signed document that never issued
    the passport. An empty field is a gap the operator fills; an invented one is a lie nobody sees.

    When the label is unreadable the authority is still findable by its own suffix, so the page is
    swept for it before giving up. Names wrap, hence the two-line window in both passes.
  */
  let m = (ai >= 0 ? capsPhrase([ls[ai + 1], ls[ai + 2]].filter(Boolean).join(' ')) : '')
    .match(/^(.*\bII[BV])\b/);
  if (!m) {
    for (let i = 0; i < ls.length && !m; i++) {
      m = capsPhrase([ls[i], ls[i + 1]].filter(Boolean).join(' ')).match(/^(.*\bII[BV])\b/);
    }
  }
  const issuer = m ? m[1] : '';
  return {
    placeOfBirth,
    issueDate: dateAfter(ls, ['DATE OF ISSUE', 'BERILGAN SANASI']),
    issuer,
  };
}
