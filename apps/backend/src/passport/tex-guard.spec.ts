import { fixBodyType, cleanChassis } from './tex-fields.util';

/*
  Field 10 («кузов тури») and the second half of field 11 («шасси») are printed from a small fixed
  vocabulary. When the OCR box drifts off the field it reads whatever is next to it — a caption on
  the certificate — and that phrase was accepted and stored, from where it printed into «Кузов тури»
  on the приказ, the акт and the contract.

  A caption is not a body type, and a phrase is not a chassis number. Both now come back empty,
  which the operator sees as a blank to fill rather than a plausible-looking value they have no
  reason to check.
*/
describe('fixBodyType keeps body types and nothing else', () => {
  it('snaps an OCR misread to the printed spelling', () => {
    expect(fixBodyType('YENGIL SEOAN')).toBe('YENGIL SEDAN');
    expect(fixBodyType('UNVERSAL')).toBe('UNIVERSAL');
  });

  it('keeps a clean value untouched', () => {
    expect(fixBodyType('YENGIL SEDAN')).toBe('YENGIL SEDAN');
    expect(fixBodyType('AVTOBUS')).toBe('AVTOBUS');
  });

  it('refuses a caption the OCR box drifted onto', () => {
    expect(fixBodyType("OLDI KO'RINISH")).toBe('');
    expect(fixBodyType('ORQA KORINISH')).toBe('');
    expect(fixBodyType('TEXNIK PASPORT')).toBe('');
  });

  it('refuses an empty or whitespace read rather than returning a space', () => {
    expect(fixBodyType('')).toBe('');
    expect(fixBodyType('   ')).toBe('');
  });
});

describe('cleanChassis keeps an identifier or the «none» marker', () => {
  it('keeps the printed «no chassis number» marker, normalised', () => {
    expect(cleanChassis('RAKAMSIZ')).toBe('RAKAMSIZ');
    expect(cleanChassis('raqamsiz')).toBe('RAQAMSIZ');
  });

  it('keeps a real chassis code', () => {
    expect(cleanChassis('XWB7T12YDLP165062')).toBe('XWB7T12YDLP165062');
    expect(cleanChassis('AB-12345')).toBe('AB-12345');
  });

  it('refuses a phrase', () => {
    expect(cleanChassis("OLDI KO'RINISH")).toBe('');
    expect(cleanChassis('MA’LUMOT YO‘Q')).toBe('');
  });

  it('refuses a fragment too short to be an identifier', () => {
    expect(cleanChassis('AB')).toBe('');
  });
});
