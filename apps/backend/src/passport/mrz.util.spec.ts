import { scoreConfidence, mapMrzToBorrower, namesFromMrzLine, yymmddToIso, extractMrzLines, normalizeMrzLines, expiryWarnings, MrzDetail } from './mrz.util';

const detail = (field: string, valid: boolean): MrzDetail => ({ field, value: '', valid });

describe('scoreConfidence', () => {
  const allChecks = (valid: boolean): MrzDetail[] => [
    detail('compositeCheckDigit', valid),
    detail('documentNumberCheckDigit', valid),
    detail('birthDateCheckDigit', valid),
    detail('expirationDateCheckDigit', valid),
    detail('personalNumberCheckDigit', valid),
  ];
  it('all check digits valid → 100', () => {
    expect(scoreConfidence(allChecks(true))).toBe(100);
  });
  it('composite invalid but every field check valid → high but below 100', () => {
    // The composite is weighted LOW (1): it re-covers the same fields + fragile '<' fillers, so an
    // OCR-corrupted filler must not crater a field-verified read. Loses weight 1 of 9 → 89.
    const d = allChecks(true).map((x) => (x.field === 'compositeCheckDigit' ? { ...x, valid: false } : x));
    const score = scoreConfidence(d);
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThan(100);
  });
  it('no check digits → 0', () => {
    expect(scoreConfidence([detail('firstName', true)])).toBe(0);
  });
});

describe('yymmddToIso', () => {
  it('maps a past birth date (2000s)', () => {
    expect(yymmddToIso('900101', false)).toBe('1990-01-01T00:00:00.000Z');
  });
  it('rejects an impossible date', () => {
    expect(yymmddToIso('991399', false)).toBeNull();
    expect(yymmddToIso('abc', false)).toBeNull();
  });

  it('rejects a day the month does not have, instead of rolling into the next one', () => {
    // Date.UTC(2031, 3, 31) is 01.05.2031. A misread «31.04» must not leave here as a real date and
    // end up printed on a document.
    expect(yymmddToIso('310431', true)).toBeNull(); // 31 April
    expect(yymmddToIso('310230', true)).toBeNull(); // 30 February
    expect(yymmddToIso('310430', true)).toBe('2031-04-30T00:00:00.000Z'); // 30 April is real
  });

  /*
    The expiry on a scanned card is read, not worked out.

    «29.07.2034» landing exactly eight years after the day it was scanned looked like arithmetic on
    today's date. It is not: the century pivot that consults the clock is only on the birth-date
    branch. Two very different «today»s, same answer — so nobody has to wonder again.
  */
  it('reads expiry from the MRZ and never computes it from today', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T00:00:00Z'));
    expect(yymmddToIso('340729', true)).toBe('2034-07-29T00:00:00.000Z');
    jest.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect(yymmddToIso('340729', true)).toBe('2034-07-29T00:00:00.000Z');
    jest.useRealTimers();
  });
});

describe('mapMrzToBorrower', () => {
  it('splits documentNumber, joins name, maps sex + 14-digit PINFL', () => {
    const out = mapMrzToBorrower({
      lastName: 'KARIMOV', firstName: 'ALISHER',
      documentNumber: 'AA1234567', birthDate: '900101', expirationDate: '300101',
      sex: 'male', personalNumber: '12345678901234',
    });
    expect(out.fullName).toBe('KARIMOV ALISHER');
    expect(out.passportSeries).toBe('AA');
    expect(out.passportNumber).toBe('1234567');
    expect(out.gender).toBe('MALE');
    expect(out.pinfl).toBe('12345678901234');
    expect(out.birthDate).toBe('1990-01-01T00:00:00.000Z');
  });
  it('drops a non-14-digit PINFL', () => {
    expect(mapMrzToBorrower({ personalNumber: '123' }).pinfl).toBe('');
  });
  it('drops digit-bearing filler noise folded into the name', () => {
    expect(mapMrzToBorrower({ lastName: 'ASKAROV', firstName: 'MUXTOR 20L46' }).fullName).toBe('ASKAROV MUXTOR');
  });
  it('takes PINFL from TD1 optional1 when personalNumber is absent', () => {
    const out = mapMrzToBorrower({ documentNumber: 'AE1295616', optional1: '40807841080026' });
    expect(out.pinfl).toBe('40807841080026');
    expect(out.passportSeries).toBe('AE');
    expect(out.passportNumber).toBe('1295616');
  });
});

describe('namesFromMrzLine', () => {
  it('recovers the given name the strict parser nulls on junk-polluted filler', () => {
    expect(namesFromMrzLine('VASKAROV<<MUXTOR<<<<<<<20L46<<')).toBe('VASKAROV MUXTOR');
  });
  it('reads a clean surname<<given line', () => {
    expect(namesFromMrzLine('QODIROVA<<XOLISXON<<<<<<<<<<<<')).toBe('QODIROVA XOLISXON');
  });
});

describe('extractMrzLines', () => {
  it('picks the two trailing MRZ lines from noisy text', () => {
    const text = [
      'REPUBLIC OF UZBEKISTAN',
      'P<UZBKARIMOV<<ALISHER<<<<<<<<<<<<<<<<<<<<<<<<',
      'AA12345670UZB9001011M3001011<<<<<<<<<<<<<<02',
    ].join('\n');
    const lines = extractMrzLines(text);
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('P<UZB')).toBe(true);
  });

  it('keeps the number line even when it has NO "<" filler (fully-populated personal number)', () => {
    // Real UZ passport: line 2 is all digits/letters, no '<'. Requiring '<' per line dropped it,
    // leaving a single line that never parses. The '<' need only appear on the GROUP (line 1 here).
    const text = [
      'OZBEKISTON RESPUBLIKASI',
      'P<UZBISMOILOV<<KHURSHID<<<<<<<<<<<<<<<<<<<<<<',
      'AB69352446UZB0007319M27061445310700532003968',
    ].join('\n');
    const lines = extractMrzLines(text);
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith('AB69352446')).toBe(true);
    expect(lines[1].includes('<')).toBe(false);
  });
});

describe('normalizeMrzLines', () => {
  it('truncates an over-long TD3 line and pads a short one to 44', () => {
    const out = normalizeMrzLines([
      'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<', // 45
      'L898902C36UTO7408122F1204159ZE184226B<<<<<1',   // 43
    ]);
    expect(out.every((l) => l.length === 44)).toBe(true);
  });
  it('normalizes a 3-line TD1 to 30 chars each', () => {
    const out = normalizeMrzLines(['I<UTOD231458907', '7408122F1204159UTO', 'ERIKSSON<<ANNA<MARIA']);
    expect(out.every((l) => l.length === 30)).toBe(true);
  });
  it('leaves a single line untouched (needs 2+ to infer a format)', () => {
    expect(normalizeMrzLines(['ABC<<<'])).toEqual(['ABC<<<']);
  });
});

describe('yymmddToIso — expiry century', () => {
  it('always resolves an expiry to the 2000s (no 1900s rollover)', () => {
    expect(yymmddToIso('490101', true)).toBe('2049-01-01T00:00:00.000Z');
    expect(yymmddToIso('300101', true)).toBe('2030-01-01T00:00:00.000Z');
  });
});

describe('mapMrzToBorrower — nationality', () => {
  it('maps a nationality code to its localized name', () => {
    expect(mapMrzToBorrower({ nationality: 'UZB' }).nationality).toBe('O‘zbekiston Respublikasi');
    expect(mapMrzToBorrower({ nationality: 'KAZ' }).nationality).toBe('Qozog‘iston');
  });
  it('keeps an unknown code as-is and empty when absent', () => {
    expect(mapMrzToBorrower({ nationality: 'UTO' }).nationality).toBe('UTO');
    expect(mapMrzToBorrower({}).nationality).toBe('');
  });
});

describe('expiryWarnings', () => {
  const now = new Date('2026-07-03T00:00:00.000Z');
  it('flags an expired passport', () => {
    expect(expiryWarnings('2020-01-01T00:00:00.000Z', now)).toEqual(['expired']);
  });
  it('flags one expiring within 90 days', () => {
    expect(expiryWarnings('2026-08-01T00:00:00.000Z', now)).toEqual(['expiring_soon']);
  });
  it('no warning for a comfortably valid passport', () => {
    expect(expiryWarnings('2030-01-01T00:00:00.000Z', now)).toEqual([]);
  });
  it('no warning when expiry is missing', () => {
    expect(expiryWarnings(null, now)).toEqual([]);
  });
});
