/**
 * Lender master data (Organization id 'default') — every document's letterhead and requisites block
 * reads this row.
 *
 * Copied cell by cell from the «Д0» sheet of the reference workbook «АВТО мфл APEX (2).xlsx», the
 * owner's own current form. The spelling is theirs and is kept exactly: «шахар», «кучаси», «МЧЖ»
 * after the name rather than before it.
 *
 * Its own file because two things write it, and they must not drift: the full seed, and
 * sync-organization.ts — which exists because the full seed also resets the four seeded logins'
 * passwords, so it cannot be the way a live deployment updates its own name.
 *
 * The licence («61», 22.06.2019) is character-for-character what the PREVIOUS organisation had —
 * every other row of Д0 differs between the two workbooks, and only this one is identical, which
 * reads as a cell nobody edited when the form was rebranded. Left as the sheet has it, flagged.
 * Both phone numbers are placeholder patterns («90-000-79-25»).
 *
 * The account and MFO are stored WITHOUT the «№» that sits in front of them in the sheet —
 * doc-layout.ts prints «р/с: №…» itself, and keeping it here produced «№№».
 */
export const ORGANIZATION = {
  tradeMark: 'FINCOM INVEST',
  nameMixed: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
  nameUpper: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
  nameSuffix: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
  // The reference prints the short form in the opening paragraph too — this is not an abbreviation
  // of some longer name we are missing.
  directorShort: 'Таджибаев А.Ю',
  directorFull: 'Таджибаев А.Ю',
  legalBasis: 'Низом',
  address: 'Тошкент шахар, Чилонзор тумани, Катта Чилонзор-3 МФЙ Чилонзор кучаси 82в-уй',
  bankAccount: '2021 6000 8073 0412 2001',
  bankMfo: '01196',
  bankName: '«APEX BANK» АЖ',
  phone: '90-000-79-25',
  phone2: '70-224-00-60',
  inn: '312 356 239',
  licenseNo: '61',
  licenseDate: new Date('2019-06-22T00:00:00Z'),
};
