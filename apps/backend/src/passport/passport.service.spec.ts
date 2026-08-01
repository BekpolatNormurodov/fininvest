import sharp from 'sharp';
import { PassportService } from './passport.service';
import type { OcrFn } from './passport.service';

// Classic ICAO TD3 sample with valid check digits (mrz package README).
const VALID_TD3 = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

// Real UZ ID (TD1) MRZ with valid check digits; PINFL is in optional1 (line 1, cols 16-29).
const VALID_TD1 = [
  'IUUZBAE1295616040807841080026<',
  '8407085F3501209UZBUZB<<<<<<<<8',
  'QODIROVA<<XOLISXON<<<<<<<<<<<<',
].join('\n');

/*
  These render real images through sharp — an upscale plus four orientation passes — even
  though the OCR itself is stubbed. That is well under a second on an idle machine and can
  cross Jest's 5s default when the whole suite runs the box hot, which showed up as a
  different one of them timing out on each run. The work is expected; the ceiling was not.
*/
jest.setTimeout(30_000);

describe('PassportService', () => {
  const svc = new PassportService();
  // A realistic-scan-sized blank (OCR is stubbed, so content is irrelevant — but a 12px image would
  // be upscaled ~130× by preprocess, making these fast tests slow). Real photos are ~1000px+.
  let blankImage: Buffer;
  beforeAll(async () => {
    blankImage = await sharp({ create: { width: 1000, height: 700, channels: 3, background: '#fff' } }).png().toBuffer();
  });

  it('reads a valid MRZ (stubbed OCR) → 100% confidence and mapped name', async () => {
    const res = await svc.scan(blankImage, async () => VALID_TD3);
    expect(res.confidence).toBe(100);
    expect(res.format).toBe('TD3');
    expect(res.fields.fullName.startsWith('ERIKSSON')).toBe(true);
    expect(res.rawMrz).toHaveLength(2);
    expect(res.perField.length).toBeGreaterThan(0);
  });

  it('returns an empty result with a warning when no MRZ is found', async () => {
    const res = await svc.scan(blankImage, async () => 'no machine readable zone here');
    expect(res.confidence).toBe(0);
    expect(res.warnings).toContain('mrz_not_found');
  });

  it('recovers via the binarized second pass when the base pass is unreadable', async () => {
    let calls = 0;
    const flaky: OcrFn = async () => (++calls > 4 ? VALID_TD3 : 'blurry noise ####');
    const res = await svc.scan(blankImage, flaky);
    expect(res.confidence).toBe(100);
    expect(calls).toBeGreaterThan(4);
  });

  it('warns when the scanned passport is already expired', async () => {
    // VALID_TD3 expires 2012-04-15 → always in the past.
    const res = await svc.scan(blankImage, async () => VALID_TD3);
    expect(res.warnings).toContain('expired');
  });

  it('exposes a nationality string on the result fields', async () => {
    const res = await svc.scan(blankImage, async () => VALID_TD3);
    expect(typeof res.fields.nationality).toBe('string');
  });

  it('does NOT surface non-MRZ garbage: header text padded to a valid width parses at 0% → not found', async () => {
    // With the char whitelist, OCR of the passport HEADER can yield 44-char [A-Z0-9<] lines that
    // normalizeMrzLines makes parseable. Every check digit fails (conf 0) → must be treated as
    // not-found, never returned as fake borrower fields.
    // All-letter/filler fields: no numeric check position can validate → guaranteed conf 0.
    const headerGarbage = [
      'OZBEKISTONRESPUBLIKASI<REPUBLICOFUZBEKISTAN<',
      'PASSPORTPASSPORT<UZB<REPUBLIC<OF<UZBEKISTAN<',
    ].join('\n');
    const res = await svc.scan(blankImage, async () => headerGarbage);
    expect(res.confidence).toBe(0);
    expect(res.warnings).toContain('mrz_not_found');
    expect(res.fields.fullName).toBe('');
    expect(res.fields.passportSeries).toBe('');
  });

  it('recovers when OCR adds stray filler chars (wrong line length) — mrz.parse is strict on length', async () => {
    const [l1, l2] = VALID_TD3.split('\n');
    const noisy = [l1 + '<<', l2].join('\n'); // 46 + 44: raw parse() throws "unrecognized document format"
    const res = await svc.scan(blankImage, async () => noisy);
    expect(res.confidence).toBe(100);
  });

  it('scanIdBack reads a TD1 MRZ (stubbed) → PINFL + series/number', async () => {
    const res = await svc.scanIdBack(blankImage, async () => VALID_TD1);
    expect(res.confidence).toBe(100);
    expect(res.format).toBe('TD1');
    expect(res.fields.passportSeries).toBe('AE');
    expect(res.fields.passportNumber).toBe('1295616');
    expect(res.fields.pinfl).toBe('40807841080026');
  });

  it('scanIdCard merges back MRZ numbers with the front name', async () => {
    const frontText = ['Surname', 'QODIROVA', 'Given name(s)', 'XOLISXON', 'Patronymic', 'MUXTOROVNA', 'Date of issue', '21.01.2025'].join('\n');
    const res = await svc.scanIdCard(
      blankImage, blankImage, // content irrelevant — OCR is stubbed; must be valid images for sharp
      async () => VALID_TD1, // mrz OCR (back)
      async () => frontText, // text OCR (front + back VIZ)
    );
    expect(res.docType).toBe('ID');
    expect(res.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
    expect(res.fields.pinfl).toBe('40807841080026');
    expect(res.fields.passportIssueDate).toBe('2025-01-21T00:00:00.000Z');
    expect(res.unverifiedFields).toContain('fullName');
  });

  it('scanIdCard reports id_back_mrz_not_found when the back has no MRZ', async () => {
    const res = await svc.scanIdCard(blankImage, blankImage, async () => 'no mrz', async () => 'Surname\nQODIROVA');
    expect(res.warnings).toContain('id_back_mrz_not_found');
  });
});
