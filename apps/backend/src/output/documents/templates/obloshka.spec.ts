import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { obloshkaTemplate } from './obloshka';

describe('obloshkaTemplate (обложка — cover page)', () => {
  it('renders the cover: org name, the borrower name, the bosh kelishuv line and the terms', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(obloshkaTemplate(c));

    expect(text).toContain('«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ');
    expect(text).toContain('ЖЎЛДИБАЕВ РУСЛАН');
    expect(text).toContain('СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ КЕЛИШУВ');
    expect(text).toContain('Фоиз ставкаси: 55%');
    expect(text).toContain('Микромолия линияси муддати: 24 ойгача');
    expect(text.replace(/\s/g, ' ')).toContain('150 000 000,00 сум');
    expect(text).toContain('Тошкент шахар, 05 Январь 2026 й.');
  });

  it('is a title page — carries no table and no dossier key/value grid', () => {
    const def = obloshkaTemplate(mockCaseDoc());
    const json = JSON.stringify(def);
    expect(json).not.toContain('"table"');
    // Fields that only belonged to the old invented summary grid.
    const text = flattenDocText(def);
    expect(text).not.toContain('ЖШШИР');
    expect(text).not.toContain('Гаровлар сони');
  });

  it('never crashes / shows NaN when the credit-line fields are missing — renders "—" instead', () => {
    const c = mockCaseDoc({
      amount: null as unknown as never,
      creditLine: {
        loanType: null as unknown as never,
        amountTotal: null as unknown as never,
        termMonths: null as unknown as never,
        interestRate: null as unknown as never,
        lineDate: null as unknown as never,
      },
    });
    const text = flattenDocText(obloshkaTemplate(c));

    expect(text).toContain('—');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
  });
});
