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
  });

  /*
    Three details read off the cells of «обложка» rather than chosen.

    B27 spells «миқдори» with қ — we had к, a different letter. B36 closes with «г.» where every
    other form in the book uses «й.»: this sheet's own inconsistency, and following it is the point.
    And B25–B27 each begin with a space, which is why the three terms lines sit a fraction right of
    the margin instead of hard against it.
  */
  it('follows the sheet on the three details that are easy to get almost right', () => {
    const text = flattenDocText(obloshkaTemplate(mockCaseDoc()));
    expect(text).toContain('миқдори');            // қ, not к
    expect(text).not.toContain('микдори');
    expect(text).toContain('Тошкент шахар, 05 Январь 2026 г.');   // г., not й.
    expect(text).toContain(' Фоиз ставкаси:');    // the cell's own leading space
  });

  /*
    A title page, and the only frame it has.

    The reference screenshot shows a grid across the whole page. Those are Excel's own SCREEN
    gridlines, not the form: the sheet is saved in pageBreakPreview — which is where its «Страница 1»
    watermark comes from — and printGridLines is off. Its only real border is the outer box: a left
    edge on column B, a right on F, a top on row 2, a bottom on row 36. Drawing the screen grid
    would put lines on a signed cover that the printed form does not have.
  */
  it('is a title page — one outer frame, no table', () => {
    const def = obloshkaTemplate(mockCaseDoc());
    expect(JSON.stringify(def)).not.toContain('"table"');
    // The frame is a page background, so it is a function and never reaches JSON — call it.
    const bg = (def.background as (p: number, s: { width: number; height: number }) => { canvas: { type: string }[] })(1, { width: 595, height: 842 });
    expect(bg.canvas.map((x) => x.type)).toEqual(['rect']);
    // Fields that only belonged to the old invented summary grid.
    const text = flattenDocText(def);
    expect(text).not.toContain('ЖШШИР');
    expect(text).not.toContain('Гаровлар сони');
  });

  /*
    The sizes are the sheet's: 20 / 36 / 16 / 11. At 36pt a long name wraps, which is what the
    reference cover does and what makes a dossier findable in a stack of them — but it still has to
    be ONE page, and the spacing below was tuned against a real PDF render, not by arithmetic.
  */
  it('uses the sheet\'s type sizes and still fits on one page', () => {
    const json = JSON.stringify(obloshkaTemplate(mockCaseDoc({ borrower: { fullName: 'UBAYDULLAYEV ZUXRIDDIN NASRIDDINOVICH' } as never })));
    for (const size of [20, 36, 16, 11]) expect(json).toContain(`"fontSize":${size}`);
    const gaps: string[] = json.match(/"margin":\[0,(\d+),0,0\]/g) ?? [];
    let total = 0;
    for (const g of gaps) total += Number(/,(\d+),/.exec(g)![1]);
    // A4 less margins is 742pt; the text itself takes ~195pt at these sizes and wraps.
    expect(total).toBeLessThanOrEqual(742 - 195);
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
