/**
 * Pure MRZ helpers — no I/O, no OCR. The confidence score comes from the passport
 * MRZ check digits (a [7,3,1]-weighted mod-10 checksum per field), so the accuracy
 * percentage is verified arithmetic, not a guess.
 */
import { nationalityName } from '@credit-core/shared';

/** One entry from the `mrz` package's parse `details` array. */
export interface MrzDetail {
  field: string;
  value: unknown;
  valid: boolean;
}

/** MRZ field values (subset we map) from the `mrz` package's parse `fields`. */
export interface MrzFields {
  firstName?: string | null;
  lastName?: string | null;
  documentNumber?: string | null;
  birthDate?: string | null; // YYMMDD
  expirationDate?: string | null; // YYMMDD
  sex?: string | null; // 'male' | 'female' | 'M' | 'F' | ...
  personalNumber?: string | null;
  optional1?: string | null; // TD1 optional data line-1 (Uzbek: 14-digit PINFL)
  nationality?: string | null; // ISO alpha-3 (e.g. 'UZB')
}

/**
 * Check-digit weights. The per-field checks (document number, birth, expiry) carry the most weight:
 * each independently verifies real data. The whole-MRZ composite is weighted LOW on purpose — it
 * re-covers the same fields plus the fragile '<' fillers, so it is the most OCR-brittle digit (a
 * single misread filler fails it) while adding little beyond the field checks. A composite-only
 * failure on an otherwise field-verified read is almost always harmless OCR filler noise, so it
 * must not dominate the score.
 */
export const CHECK_WEIGHT: Record<string, number> = {
  compositeCheckDigit: 1,
  documentNumberCheckDigit: 3,
  birthDateCheckDigit: 2,
  expirationDateCheckDigit: 2,
  personalNumberCheckDigit: 1,
};

/** Weighted mean of the present check-digit validities → 0..100. */
export function scoreConfidence(details: MrzDetail[]): number {
  let got = 0;
  let total = 0;
  for (const d of details) {
    const w = CHECK_WEIGHT[d.field];
    if (w == null) continue;
    total += w;
    if (d.valid) got += w;
  }
  if (total === 0) return 0;
  return Math.round((got / total) * 100);
}

/** YYMMDD → ISO date at UTC midnight. `future` biases the century (expiry) vs past (birth). */
export function yymmddToIso(yymmdd: string | null | undefined, future: boolean): string | null {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const cc = new Date().getFullYear() % 100;
  // Expiry is always this century (passports don't expire in the 1900s). Birth is past-biased.
  const year = future ? 2000 + yy : yy <= cc ? 2000 + yy : 1900 + yy;
  const iso = new Date(Date.UTC(year, mm - 1, dd));
  // 31 in a 30-day month is a misread, and Date.UTC rolls it into the next month without saying so —
  // «31.04» would leave as 01.05 and be printed on a document as if the card said it.
  if (iso.getUTCDate() !== dd) return null;
  return iso.toISOString();
}

/**
 * Names straight from a raw `SURNAME<<GIVEN` MRZ line (the TD1 3rd line) — a resilient fallback for
 * when the strict `mrz` parser nulls the given name because OCR left junk in the name field's filler
 * (e.g. "VASKAROV<<MUXTOR<<<<<<<20L46" makes the parser return firstName=null, losing "MUXTOR").
 * Split on the '<<' surname/given separator, turn the remaining '<' fillers into spaces, and keep only
 * clean alphabetic tokens — dropping digit-bearing filler noise like "20L46". TD1 only: the TD3/TD2
 * name line is prefixed with the document type + country code, which this would wrongly fold in.
 */
export function namesFromMrzLine(line: string): string {
  const seg = (s: string) => s.replace(/</g, ' ').split(/\s+/).filter((t) => /^[A-Z][A-Z'`-]*$/.test(t));
  const [surname, ...rest] = line.split('<<');
  return [...seg(surname ?? ''), ...seg(rest.join(' '))].join(' ');
}

/** Map MRZ field values to the borrower form shape. */
export function mapMrzToBorrower(fields: MrzFields) {
  const clean = (s: string | null | undefined) => (s ?? '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  // Name tokens never contain digits. OCR filler noise on the name line (e.g. a garbled '<' run read
  // as "20L46") gets folded into the secondary identifier by the parser — drop any token carrying a
  // digit so it doesn't leak into the surfaced name.
  const nameTokens = (s: string | null | undefined) => clean(s).split(' ').filter((t) => t && !/\d/.test(t));
  const fullName = [...nameTokens(fields.lastName), ...nameTokens(fields.firstName)].join(' ');
  const dn = (fields.documentNumber ?? '').toUpperCase().replace(/</g, '');
  const passportSeries = dn.match(/^[A-Z]{2}/)?.[0] ?? '';
  const passportNumber = dn.replace(/^[A-Z]{2}/, '').replace(/\D/g, '').slice(0, 7);
  const sex = (fields.sex ?? '').toString().toUpperCase();
  const gender: 'MALE' | 'FEMALE' | '' = sex.startsWith('M') ? 'MALE' : sex.startsWith('F') ? 'FEMALE' : '';
  // Passport (TD3) carries the personal number in `personalNumber`; UZ ID (TD1) puts the
  // 14-digit PINFL in `optional1`. Take whichever holds a 14-digit run.
  const pinflSrc = (fields.personalNumber ?? '') || (fields.optional1 ?? '');
  const pinflMatch = pinflSrc.replace(/</g, '').match(/\d{14}/);
  const pinflDigits = pinflMatch ? pinflMatch[0] : '';
  return {
    fullName,
    passportSeries,
    passportNumber,
    birthDate: yymmddToIso(fields.birthDate, false),
    passportExpiry: yymmddToIso(fields.expirationDate, true),
    gender,
    nationality: nationalityName(fields.nationality),
    pinfl: pinflDigits.length === 14 ? pinflDigits : '',
  };
}

/** Passport-validity warnings from an ISO expiry date: 'expired', 'expiring_soon' (≤90d), or none. */
export function expiryWarnings(expiryIso: string | null, now: Date = new Date()): string[] {
  if (!expiryIso) return [];
  const exp = new Date(expiryIso).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (exp < today) return ['expired'];
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  if (exp - today <= ninetyDays) return ['expiring_soon'];
  return [];
}

/**
 * Pull the MRZ lines out of noisy OCR text. MRZ lines are uppercase [A-Z0-9<] of length ≥28,
 * and sit at the bottom of the page, so we take the trailing 2 (TD2/TD3) or 3 (TD1) long lines.
 * The '<' filler is required on the GROUP, not every line: the document/number line is often all
 * digits with no '<' (e.g. a fully-populated 14-digit personal number), and requiring '<' per line
 * dropped it — leaving a single line that never parses.
 */
export function extractMrzLines(ocrText: string): string[] {
  const lines = ocrText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').toUpperCase())
    .filter((l) => l.length >= 18 && /^[A-Z0-9<]+$/.test(l));
  if (lines.length < 2) return lines.filter((l) => l.includes('<'));
  const lastLen = lines[lines.length - 1].length;
  // TD1 = 3×30; TD2 = 2×36; TD3 = 2×44. The 3rd TD1 (name) line is frequently OCR-shortened below
  // 30 (trailing '<' fillers lost), so the floor is lax (18) — but the GROUP must still hold a
  // full-length (≥28) MRZ line and a '<' filler, else it is noise, not an MRZ.
  const group = lastLen >= 34 ? lines.slice(-2) : lines.slice(-3);
  const maxLen = Math.max(...group.map((l) => l.length));
  return maxLen >= 28 && group.some((l) => l.includes('<')) ? group : [];
}

/**
 * Normalize OCR'd MRZ lines to a standard width so the strict `mrz` parser accepts them.
 * OCR frequently drops or adds a few '<' fillers, and `parse()` THROWS unless each line is
 * exactly 30 (TD1), 36 (TD2) or 44 (TD3). Pad short lines / truncate long ones to the width
 * implied by the line count (3 → TD1/30) and the longest observed line (2 → nearest of 44/36).
 */
export function normalizeMrzLines(lines: string[]): string[] {
  if (lines.length < 2) return lines;
  const widths = lines.length >= 3 ? [30] : [44, 36];
  const maxLen = Math.max(...lines.map((l) => l.length));
  const target = widths.reduce((a, b) => (Math.abs(b - maxLen) < Math.abs(a - maxLen) ? b : a));
  return lines.map((l) => (l.length >= target ? l.slice(0, target) : l + '<'.repeat(target - l.length)));
}
