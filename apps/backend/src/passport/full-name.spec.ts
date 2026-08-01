import sharp from 'sharp';
import { PassportService } from './passport.service';
import { mergeIdResult, extractIdFront } from './id-fields.util';
import { namesFromMrzLine } from './mrz.util';
import type { PassportScanResult } from '@credit-core/shared';

/*
  «факат фамилиясини тортвоти» / «ф,и,о» — the scan filled in the surname and stopped.

  Three separate causes, each of which alone produces a one-word name:

  1. A degraded front OCR read overwrote a complete MRZ name. When the front loses everything but
     the surname it still AGREES with the MRZ, so the old rule preferred it.
  2. The MRZ salvage that recovers a given name from a junk-polluted name line ran for ID cards
     (TD1) only, so a passport (TD3) kept whatever the strict parser had nulled.
  3. The front-side token pattern required four characters, so short real given names — ALI, OLIM —
     were not names as far as it was concerned.

  Each test below fails on the code as it was before this commit.
*/

const backResult = (fullName: string): PassportScanResult => ({
  confidence: 95,
  fields: {
    fullName,
    passportSeries: 'AD',
    passportNumber: '1234567',
    birthDate: '1990-05-12T00:00:00.000Z',
    passportExpiry: '2030-05-12T00:00:00.000Z',
    gender: 'MALE',
    nationality: 'UZB',
    pinfl: '52101901234567',
  },
  perField: [],
  format: 'TD1',
  rawMrz: [],
  warnings: [],
} as unknown as PassportScanResult);

const noViz = {} as never;

describe('a degraded front read never truncates a complete MRZ name', () => {
  it('keeps the three-part MRZ name when the front read only the surname', () => {
    const merged = mergeIdResult(backResult('QODIROV ALISHER BAXTIYOROVICH'), { fullName: 'QODIROV' } as never, noViz);
    expect(merged.fields.fullName).toBe('QODIROV ALISHER BAXTIYOROVICH');
  });

  it('keeps the MRZ name when the front collapsed to a single token that is not even the surname', () => {
    // All three names printed on one line: the front extractor takes one token per line and can
    // come back holding the patronymic alone.
    const merged = mergeIdResult(backResult('QODIROVA XOLISXON MUXTOROVNA'), { fullName: 'MUXTOROVNA' } as never, noViz);
    expect(merged.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
  });

  it('still prefers the front when it is the richer of the two', () => {
    // The front adds the patronymic the MRZ does not carry — the case the front exists for.
    const merged = mergeIdResult(backResult('QODIROV ALISHER'), { fullName: 'QODIROV ALISHER BAXTIYOROVICH' } as never, noViz);
    expect(merged.fields.fullName).toBe('QODIROV ALISHER BAXTIYOROVICH');
  });

  it('does not let OCR filler letters inflate the MRZ side', () => {
    // «QODIROVA<<XOLISXON<K<<<L<<<<<<» parses to four tokens, two of which are single letters.
    const merged = mergeIdResult(backResult('QODIROVA XOLISXON K L'), { fullName: 'QODIROVA XOLISXON MUXTOROVNA' } as never, noViz);
    expect(merged.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
  });
});

/*
  Driven through the SERVICE, not through namesFromMrzLine directly.

  The bug being fixed is that the salvage was gated on `format === 'TD1'`, and that gate lives in
  passport.service.ts. A test that calls namesFromMrzLine with the prefix already sliced off passes
  on the broken code too — it never touches the gate.
*/
describe('a passport MRZ yields all three names, not just the surname', () => {
  const svc = new PassportService();
  let blank: Buffer;
  beforeAll(async () => {
    blank = await sharp({ create: { width: 1000, height: 700, channels: 3, background: '#fff' } }).png().toBuffer();
  });

  // ICAO TD3 with valid check digits; the name field carries a patronymic and OCR junk in the filler,
  // which is what makes the strict parser null the given name.
  const TD3_JUNK = [
    'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<20L46<<<',
    'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
  ].join('\n');

  const TD3_CLEAN = [
    'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
    'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
  ].join('\n');

  it('recovers the names the strict parser dropped on a junk-polluted passport line', async () => {
    const res = await svc.scan(blank, async () => TD3_JUNK);
    expect(res.format).toBe('TD3');
    expect(res.fields.fullName).toBe('ERIKSSON ANNA MARIA');
  });

  it('leaves a clean passport read alone', async () => {
    const res = await svc.scan(blank, async () => TD3_CLEAN);
    expect(res.fields.fullName).toBe('ERIKSSON ANNA MARIA');
  });

  // The line helper itself, for the shape the service hands it after stripping «P<UTO».
  it('reads surname, given name and patronymic off the name line', () => {
    expect(namesFromMrzLine('P<UZBKARIMOV<<ALISHER<BAXTIYOROVICH<<<<20L46'.slice(5)))
      .toBe('KARIMOV ALISHER BAXTIYOROVICH');
  });
});

describe('short given names are names', () => {
  const front = (lines: string[]) => extractIdFront(lines.join('\n'));

  it('reads a three-letter given name instead of dropping it', () => {
    expect(front(['FAMILIYASI / SURNAME', 'QODIROV', 'ISMI / GIVEN NAME', 'ALI', 'OTASINING ISMI', 'ALIYEVICH']).fullName)
      .toBe('QODIROV ALI ALIYEVICH');
  });

  it('still refuses the labels printed on the card as names', () => {
    expect(front(['OZBEKISTON RESPUBLIKASI', 'SHAXS GUVOHNOMASI', 'FAMILIYASI / SURNAME', 'QODIROV']).fullName)
      .toBe('QODIROV');
  });
});
