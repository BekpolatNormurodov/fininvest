import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';

const profile = (over: object = {}) =>
  flattenDocText(DOC_REGISTRY.clientProfile!.build(mockCaseDoc({
    borrower: {
      phone: '+998901234567',
      entrepreneurType: "O'ZINI O'ZI BAND QILGAN FUQARO",
      closeContacts: [
        { relation: 'Ota', fullName: 'OTA OTAYEV', phone: '+998911112233' },
        { relation: 'Ona', fullName: 'ONA ONAYEVA', phone: '+998922223344' },
      ] as unknown as never,
    } as unknown as never,
    ...over,
  })));

describe('МИЖОЗ АНКЕТАСИ — the rows that were printing dashes', () => {
  it('fills «қўшимча» from the close contacts', () => {
    // They read `phones`, which the wizard never writes; the operator enters the father, the
    // mother and so on as close contacts.
    const t = profile();
    expect(t).toContain('+998911112233');
    expect(t).toContain('+998922223344');
  });

  it('does not repeat the borrower\'s own мобил among them', () => {
    const t = profile({
      borrower: {
        phone: '+998901234567',
        closeContacts: [{ relation: 'Ota', fullName: 'X', phone: '998 90 123 45 67' }] as unknown as never,
      } as unknown as never,
    });
    const block = t.slice(t.indexOf('Телефон'), t.indexOf('Оилавий'));
    expect(block).toContain('+998901234567');
    // All three «қўшимча» rows stay empty rather than echoing the mobile back.
    expect((block.match(/қўшимча —/g) ?? []).length).toBe(3);
  });

  /*
    «Соха» is Д1!C38, the activity sector, at any amount.

    Over 100 million it used to print the entrepreneur status instead — put there when that status
    was reaching no other row on the form. «Фаолият жойи» carries it now (see activity-line.spec),
    so the substitution only printed the same string twice, one line apart, and the owner asked for
    it to go. The assertion that encoded the substitution is replaced by one that forbids it.
  */
  it('carries the activity sector, at any amount', () => {
    for (const amountTotal of [50_000_000, 150_000_000]) {
      const t = profile({
        creditLine: { amountTotal: amountTotal as unknown as never },
        employment: { sector: 'Савдо / Сотув' as unknown as never },
      });
      const seg = t.slice(t.indexOf('Соха'), t.indexOf('Соха') + 50);
      expect(seg).toContain('Савдо / Сотув');
      expect(seg).not.toContain('BAND QILGAN');
      expect(seg).not.toContain('БАНД ҚИЛГАН');
    }
  });

  it('does not repeat the entrepreneur status one line below «Фаолият жойи»', () => {
    const t = profile({ creditLine: { amountTotal: 150_000_000 as unknown as never } });
    const seg = t.slice(t.indexOf('Соха'), t.indexOf('Соха') + 50);
    expect(seg).not.toContain('тадбиркор');
    expect(seg).not.toContain('банд');
  });
});

describe('the firm\'s phone reaches the documents that carry its requisites', () => {
  it.each(['contract', 'rklGen', 'grafik'])('%s prints it', (key) => {
    expect(flattenDocText(DOC_REGISTRY[key]!.build(mockCaseDoc()))).toContain('90-000-79-25');
  });
});
