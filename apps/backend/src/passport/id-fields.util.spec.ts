import { ddmmyyyyToIso, extractIdFront, extractIdBackViz, extractPassportViz, mergeIdResult } from './id-fields.util';
import type { PassportScanResult } from '@credit-core/shared';

describe('ddmmyyyyToIso', () => {
  it('parses a dot-separated date (ID)', () => {
    expect(ddmmyyyyToIso('21.01.2025')).toBe('2025-01-21T00:00:00.000Z');
  });
  it('parses a space-separated date (passport)', () => {
    expect(ddmmyyyyToIso('15 06 2017')).toBe('2017-06-15T00:00:00.000Z');
  });
  it('parses a date where OCR read a dot as a comma ("07,03.2024")', () => {
    expect(ddmmyyyyToIso('_07,03.2024 a')).toBe('2024-03-07T00:00:00.000Z');
  });
  it('rejects junk', () => {
    expect(ddmmyyyyToIso('x')).toBeNull();
    expect(ddmmyyyyToIso('40.13.2025')).toBeNull();
  });
});

describe('extractPassportViz', () => {
  // Verbatim-style noisy eng-OCR of the passport visible page (space dates, garbled labels,
  // multi-line issuer, junk tokens on value lines).
  const viz = [
    'FAMILIYAS! ISMOILOV',
    "TUG'ILGAN SANASi | TUGTLGAN JOY!",
    "31 07 2000 | QORAKO'L TUMANI avera",
    'MILLATI',
    'KiM TOMONIDAN BERILGAN',
    'BUXORO VILOYATI QORAKUL : oy',
    ': TUMANI IIB HOKE S Se 73',
    'BERILGAN SANASI / DATE OF ISSUE PERSOMALLASHTIRISH ORGANI/AUTHORETY',
    "15 06 2017 'STATE PERSONALIZATION",
  ].join('\n');

  it('reads place of birth via the place suffix', () => {
    expect(extractPassportViz(viz).placeOfBirth).toBe("QORAKO'L TUMANI");
  });
  it('reads the multi-line issuing authority', () => {
    expect(extractPassportViz(viz).issuer).toBe('BUXORO VILOYATI QORAKUL TUMANI IIB');
  });
  it('reads the space-separated issue date', () => {
    expect(extractPassportViz(viz).issueDate).toBe('2017-06-15T00:00:00.000Z');
  });

  /*
    The issuer goes straight into the contract — «… томонидан … берилган» — so a wrong one is a
    false statement on a signed document, and nobody reading the PDF can tell it was invented.

    This page carries a second line answering to the same labels: «PERSOMALLASHTIRISH
    ORGANI/AUTHORETY», with «STATE PERSONALIZATION» under it. One bad character in TOMONIDAN used to
    be enough to send that out as the issuing authority. The office suffix is what makes an
    authority an authority, so it is required now: found, or the field stays empty for the operator.
  */
  it('does not mistake the personalization line for the issuing authority', () => {
    const garbled = viz.replace('KiM TOMONIDAN BERILGAN', 'KiM TOMOHIDAN BERILGAN');
    const issuer = extractPassportViz(garbled).issuer;
    expect(issuer).not.toContain('PERSONALIZATION');
    // The authority is still on the page under its own suffix, so it is found without the label.
    expect(issuer).toBe('BUXORO VILOYATI QORAKUL TUMANI IIB');
  });

  it('returns nothing rather than a guess when no authority suffix is on the page', () => {
    const noAuthority = [
      'KiM TOMONIDAN BERILGAN',
      'STATE PERSONALIZATION CENTRE',
      'PERSOMALLASHTIRISH ORGANI/AUTHORETY',
    ].join('\n');
    expect(extractPassportViz(noAuthority).issuer).toBe('');
  });
});

describe('extractIdFront', () => {
  const text = [
    "O'ZBEKISTON RESPUBLIKASI",
    'SHAXS GUVOHNOMASI',
    'Familiyasi / Surname',
    'QODIROVA',
    'Ismi / Given name(s)',
    'XOLISXON',
    'Otasining ismi / Patronymic',
    'MUXTOROVNA',
    'Tugilgan sanasi / Date of birth   Jinsi / Sex',
    '08.07.1984   AYOL',
    'Berilgan sanasi / Date of issue   Fuqaroligi / Citizenship',
    "21.01.2025   O'ZBEKISTON",
    'Amal qilish muddati / Date of expiry   Karta raqami / Card number',
    '20.01.2035   AE1295616',
  ].join('\n');

  it('joins the full name including patronymic', () => {
    expect(extractIdFront(text).fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
  });
  it('reads issue date, birth date and expiry as ISO', () => {
    const f = extractIdFront(text);
    expect(f.issueDate).toBe('2025-01-21T00:00:00.000Z');
    expect(f.birthDate).toBe('1984-07-08T00:00:00.000Z');
    expect(f.expiryDate).toBe('2035-01-20T00:00:00.000Z');
  });
  it('reads the card number', () => {
    expect(extractIdFront(text).cardNumber).toBe('AE1295616');
  });
  it('is resilient to a missing patronymic', () => {
    const noPatr = text.replace('Otasining ismi / Patronymic\nMUXTOROVNA\n', '');
    expect(extractIdFront(noPatr).fullName).toBe('QODIROVA XOLISXON');
  });

  it('does not pick header words as the name when the "GUVOHNOMASI" anchor is unreadable', () => {
    const noisy = [
      "O'ZBEKISTON RESPUBLIKAS!",
      'wees SHAXS aA',
      'MIRZAKARIMOV',
      'NIZOMIDIN',
      'Otasining ismi / Patronymic',
      'MIRZABDULLAYEVICH',
      'Tugilgan sanasi / Date of birth',
      '29.12.1970 ERKAK',
    ].join('\n');
    expect(extractIdFront(noisy).fullName).toBe('MIRZAKARIMOV NIZOMIDIN MIRZABDULLAYEVICH');
  });

  it('keeps a surname on a value line carrying a stray OCR pipe ("| ¥3 TASKAROV 25")', () => {
    const noisy = [
      'SHAXS GUVOHNOMASI',
      '| <sFafiliyasi f Suename',
      '| ¥3 TASKAROV 25', // stray '|' must not drop the value line
      'er f jemi / Given name',
      'i me A STOR Shes',
      'Tugilgan sanasi / Date of birth',
      '19.11.1997 ERKAK',
    ].join('\n');
    expect(extractIdFront(noisy).fullName).toContain('TASKAROV');
  });

  it('extracts names from real noisy OCR (dropped/garbled labels, junk tokens)', () => {
    // Verbatim from a real eng-OCR of the fixture: no "Surname" label, "EER" junk before the
    // patronymic, label words on "/"-separated lines. The layout heuristic must still win.
    const noisy = [
      "iB )'ZBEKISTON RESPUBLIKASI 3",
      'a 8 Emma SHAXS GUVOHNOMASI Sims |',
      'Wii wo QODIROVA',
      'L Lo » Tay N d i mi / Given namals)',
      ': . - p24 XOLISXON',
      'A of \\ : A) Otasining ismi | Patromyiic',
      'EER ¥ MUXTOROVNA',
      '= - BE i= Tugiigan sanasi / Date of birth Jinsi [ Sex',
      '2 pe 08.07.1984 AYOL',
    ].join('\n');
    const f = extractIdFront(noisy);
    expect(f.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
    expect(f.birthDate).toBe('1984-07-08T00:00:00.000Z');
  });
});

const backMrz = (over: Partial<PassportScanResult['fields']> = {}): PassportScanResult => ({
  confidence: 100,
  fields: { fullName: 'QODIROVA XOLISX0O8', passportSeries: 'AE', passportNumber: '1295616', birthDate: '1984-07-08T00:00:00.000Z', passportExpiry: '2035-01-20T00:00:00.000Z', gender: 'FEMALE', nationality: "O'zbekiston Respublikasi", pinfl: '40807841080026', ...over },
  perField: [{ key: 'documentNumberCheckDigit', value: '0', valid: true }],
  format: 'TD1', rawMrz: [], warnings: [], docType: 'ID',
});

describe('extractIdBackViz', () => {
  it('cleans place of birth (drops OCR prefix noise + punctuation, garbled "Plage" label)', () => {
    const t = ['Plage of birth', "Re Al QORAKO'L TUMANI :", 'Place of issue', 'i ial atthe HV 6230 .'].join('\n');
    const v = extractIdBackViz(t);
    expect(v.placeOfBirth).toBe("QORAKO'L TUMANI");
    expect(v.issuer).toBe('IIV 6230'); // OCR read IIV→HV; normalized back by the trailing V
  });
  it('recovers a place word whose suffix OCR mangled ("TUMAN!" with digits around it)', () => {
    const t = ["m i: 264508 QORAKO'L TUMAN! 7", 'Place of issue', 'IIV 6230'].join('\n');
    expect(extractIdBackViz(t).placeOfBirth).toBe("QORAKO'L TUMAN");
  });
  it('drops a short all-caps OCR prefix like "QF" from the place of birth', () => {
    const t = ['Place of birth', 'QF ZAFAROBOD TUMANI', 'Place of issue', 'IIV 1234'].join('\n');
    expect(extractIdBackViz(t).placeOfBirth).toBe('ZAFAROBOD TUMANI');
  });
  it('drops country/header words (O‘ZBEKISTON) that bleed into the place of birth', () => {
    const t = ['Place of birth', "ZAFAROBOD TUMANI O'ZBEKISTON", 'Place of issue', 'IIV 1234'].join('\n');
    expect(extractIdBackViz(t).placeOfBirth).toBe('ZAFAROBOD TUMANI');
  });
  it('normalizes the issuer code and ignores a line with no code+number', () => {
    expect(extractIdBackViz(['Place of issue', 'IIV 6230'].join('\n')).issuer).toBe('IIV 6230');
    expect(extractIdBackViz(['Place of issue', 'NB 6230'].join('\n')).issuer).toBe('IIB 6230');
    expect(extractIdBackViz(['Place of issue', 'TAME py 14294 ye'].join('\n')).issuer).toBe('IIV 14294'); // IIV misread as "py"
    expect(extractIdBackViz(['Place of issue', 'just some words'].join('\n')).issuer).toBe('');
  });
});

describe('mergeIdResult', () => {
  const front = { fullName: 'QODIROVA XOLISXON MUXTOROVNA', issueDate: '2025-01-21T00:00:00.000Z', nationality: '', birthDate: '1984-07-08T00:00:00.000Z', expiryDate: '2035-01-20T00:00:00.000Z', cardNumber: 'AE1295616' };
  const viz = { placeOfBirth: "QORAKO'L TUMANI", issuer: 'IIV 6230' };

  it('uses MRZ numbers and the clean front name', () => {
    const r = mergeIdResult(backMrz(), front, viz);
    expect(r.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
    expect(r.fields.pinfl).toBe('40807841080026');
    expect(r.fields.passportSeries).toBe('AE');
    expect(r.fields.placeOfBirth).toBe("QORAKO'L TUMANI");
    expect(r.fields.passportIssueDate).toBe('2025-01-21T00:00:00.000Z');
    expect(r.confidence).toBe(100);
    expect(r.docType).toBe('ID');
    expect(r.unverifiedFields).toEqual(expect.arrayContaining(['fullName', 'passportIssueDate', 'placeOfBirth']));
  });
  it('keeps the MRZ name when the front surname disagrees (garbage front OCR)', () => {
    const r = mergeIdResult(backMrz({ fullName: 'BAYMIRZAYEVA GULNORA' }), { ...front, fullName: 'RESPUBLIKA GULNORA ESSER' }, viz);
    expect(r.fields.fullName).toBe('BAYMIRZAYEVA GULNORA');
  });
  it('uses the richer front name when its surname is contained in the (noisy) MRZ surname', () => {
    const r = mergeIdResult(backMrz({ fullName: 'CQODIROVA XOLISX0O8' }), front, viz);
    expect(r.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
  });
  it('keeps the MRZ name over garbage front OCR even at low confidence (no <90 escape)', () => {
    // Real ASKAROV card: composite check fails → conf 88, front laminate OCRs to noise ("STOR").
    const r = mergeIdResult(backMrz({ fullName: 'ASKAROV MUXTOR' }), { ...front, fullName: 'STOR' }, viz);
    expect(r.fields.fullName).toBe('ASKAROV MUXTOR');
  });
  it('reconciles a leading OCR-noise glyph on the surname using both sources', () => {
    // MRZ "VASKAROV" + front "TASKAROV" both prepend a junk letter to the true "ASKAROV".
    const r = mergeIdResult(backMrz({ fullName: 'VASKAROV MUXTOR' }), { ...front, fullName: 'TASKAROV STOR' }, viz);
    expect(r.fields.fullName).toBe('ASKAROV MUXTOR');
  });
  it('flags a front/back date mismatch and keeps the MRZ value', () => {
    const r = mergeIdResult(backMrz(), { ...front, birthDate: '1990-01-01T00:00:00.000Z' }, viz);
    expect(r.warnings).toContain('front_back_mismatch');
    expect(r.fields.birthDate).toBe('1984-07-08T00:00:00.000Z');
  });
});
