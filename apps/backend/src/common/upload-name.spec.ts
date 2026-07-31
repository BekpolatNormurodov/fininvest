import { decodeUploadName } from './upload-name.util';

/** How a browser actually sends it: UTF-8 bytes, read back as Latin-1. */
const asBrowserSends = (s: string) => Buffer.from(s, 'utf8').toString('latin1');

describe('decodeUploadName', () => {
  it('repairs the Cyrillic names this system actually receives', () => {
    for (const real of ['пас олди.png', 'тех орка.jpg', 'Ҳужжат №12 (нусха).pdf', 'Кредит шартномаси.docx']) {
      expect(decodeUploadName(asBrowserSends(real))).toBe(real);
    }
  });

  it('repairs the exact strings sitting in the database', () => {
    /*
      Case BR-2026-0002 carries these two, and they are what the operator sees in the document list.

      Built from bytes rather than pasted: the mangled form contains C1 control characters — «пас»
      ends in D1 81, and 0x81 is invisible — so copying it out of a terminal silently drops a byte
      and the test would assert against a string the system never produced.
    */
    expect(decodeUploadName(asBrowserSends('пас олди.png'))).toBe('пас олди.png');
    expect(decodeUploadName(asBrowserSends('тех орка.jpg'))).toBe('тех орка.jpg');
  });

  it('leaves an ASCII name exactly as it is', () => {
    for (const name of ['passport.png', 'tex-passport (2).jpg', 'ARIZA_2026.xlsx', '']) {
      expect(decodeUploadName(name)).toBe(name);
    }
  });

  it('leaves a name that is already correct — repairing twice is its own corruption', () => {
    const real = 'пас олди.png';
    expect(decodeUploadName(real)).toBe(real);
    expect(decodeUploadName(decodeUploadName(asBrowserSends(real)))).toBe(real);
  });

  it('leaves a genuinely Latin-1 name alone rather than guessing', () => {
    // Western European accents are valid Latin-1 and are not a UTF-8 misread.
    for (const name of ['café.pdf', 'Müller.docx', 'año.png']) {
      expect(decodeUploadName(name)).toBe(name);
    }
  });

  it('handles null and undefined', () => {
    expect(decodeUploadName(null)).toBe('');
    expect(decodeUploadName(undefined)).toBe('');
  });
});
