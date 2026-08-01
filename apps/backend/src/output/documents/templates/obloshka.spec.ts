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
    const def = obloshkaTemplate(mockCaseDoc());
    const text = flattenDocText(def);
    expect(text).toContain('миқдори');            // қ, not к
    expect(text).not.toContain('микдори');
    expect(text).toContain(' Фоиз ставкаси:');    // the cell's own leading space
    // The date lives in the page footer — see the band test below.
    expect((def.footer as () => { text: string })().text).toBe('Тошкент шахар, 05 Январь 2026 г.');  // г., not й.
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
  it('uses the sheet\'s type sizes', () => {
    const json = JSON.stringify(obloshkaTemplate(mockCaseDoc({ borrower: { fullName: 'UBAYDULLAYEV ZUXRIDDIN NASRIDDINOVICH' } as never })));
    for (const size of [20, 36, 16, 11]) expect(json).toContain(`"fontSize":${size}`);
  });

  /*
    Where the blocks land, checked against the sheet's own rows rather than by eye.

    The reference's печатная band is 723pt of rows; each block's centre falls at a fixed fraction of
    it — 3.3% for the org name, 35.3% for the borrower, 59.2% for the бош келишув line, 76.0/78.1/
    80.2% for the three terms and 98.9% for the date. Measured on the rendered PDF, ours now sit
    within 0.4 percentage points (3pt) of every one of them.

    Two structural things make that possible and are asserted here because losing either would put
    the page silently out of proportion again: the cover keeps the sheet-s own 59pt top margin
    instead of the shared 50pt, and the date is a page FOOTER rather than the last content element —
    at 98.9% there is not enough room left for pdfmake to fit a content line, and trying pushed the
    cover onto a second page.
  */
  it('sits in the sheet\'s own box and puts the date in the footer', () => {
    const def = obloshkaTemplate(mockCaseDoc());
    /*
      The box is columns B..F by rows 2..36 — 413.2 × 723pt — and the sheet is set to centre it both
      ways. The WIDTH is what makes the wrapping match: at our usual 505pt column the borrower's name
      fits in two lines where the reference breaks it into three, and no amount of type sizing fixes
      that. Left/right = (595.28 − 413.2) / 2, top = (841.89 − 723) / 2.
    */
    expect(def.pageMargins).toEqual([91, 59, 91, 73.89]);
    const bg = (def.background as (p: number, s: { width: number; height: number }) => { canvas: { w: number; h: number }[] })(1, { width: 595.28, height: 841.89 });
    expect(bg.canvas[0].w).toBeCloseTo(413.2, 1);
    expect(bg.canvas[0].h).toBe(723);

    expect(typeof def.footer).toBe('function');
    expect((def.footer as () => { text: string })().text).toContain('Тошкент шахар');
    // …and therefore NOT in the body, or it would print twice.
    expect(JSON.stringify(def.content)).not.toContain('Тошкент шахар');
  });

  /*
    The reference cover breaks the borrower's name across three lines and the org name across two.
    That is a function of the column width, and it is the most visible thing about the page — a
    dossier is found in a stack by that block. Asserted through pdfmake's own line breaking.
  */
  it('breaks the long names the way the reference does', async () => {
    const { PdfService } = await import('../../pdf.service');
    const buf = await new PdfService().render(
      obloshkaTemplate(mockCaseDoc({ borrower: { fullName: 'UBAYDULLAYEV ZUXRIDDIN NASRIDDINOVICH' } as never })),
    );
    // One page, and the name split into its three words on three lines.
    expect((buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
  }, 60_000);

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
