import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { rklGenTemplate } from './rkl-gen';

describe('rklGenTemplate', () => {
  it('renders the real term/rate/penalty for a fully-populated credit line', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).toContain('24 ой');
    expect(text).toContain('55%');
    expect(text).toContain('105%');
  });

  it('never fabricates a default 60-month/55%/105% term when the credit line lacks them', () => {
    const c = mockCaseDoc({
      creditLine: {
        interestRate: null as unknown as never,
        penaltyRate: null as unknown as never,
        termMonths: null as unknown as never,
      },
    });
    const text = flattenDocText(rklGenTemplate(c));

    // The old bug hardcoded term=60/rate=55%/penalty=105% regardless of data.
    expect(text).not.toContain('60 ой');
    expect(text).not.toContain('55%');
    expect(text).not.toContain('105%');
    expect(text).toContain('—');
  });

  it('drives the insurance premium clause from the real insurance rate, never a hardcoded 2%', () => {
    const c = mockCaseDoc({
      creditLine: { insurance: { premium: null as unknown as never, insuranceRate: 0.03 as unknown as never } },
    });
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).toContain('3%');
    expect(text).not.toContain('йилига 2%');
  });

  it('omits the premium rate literal (never fabricates 2%) when neither premium nor rate is known', () => {
    const c = mockCaseDoc({
      creditLine: { insurance: { premium: null as unknown as never, insuranceRate: null as unknown as never } },
    });
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).not.toContain('2%');
    expect(text).not.toContain('йилига 2%');
  });

  it('binds the borrower name, amount (Cyrillic words) and line number from the case data', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(rklGenTemplate(c)).replace(/\s/g, ' ');

    expect(text).toContain(c.borrower!.fullName);
    expect(text).toContain('150 000 000,00 (Бир юз эллик миллион сўм 00 тийин)');
    expect(text).toContain('РКЛ-0042');
  });

  it('opens with the trade mark before the org name, as the sheet does', () => {
    const text = flattenDocText(rklGenTemplate(mockCaseDoc()));
    expect(text).toContain('«FINCOM INVEST» Савдо белгиси «FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ');
  });

  it('falls back to the plain org name when no trade mark is configured', () => {
    const text = flattenDocText(rklGenTemplate(mockCaseDoc({ organization: { tradeMark: null as unknown as never } })));
    expect(text).not.toContain('Савдо белгиси');
    expect(text).toContain('«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ');
  });

  it('carries no org letterhead (the sheet has none)', () => {
    const text = flattenDocText(rklGenTemplate(mockCaseDoc()));
    // The address/bank line only ever came from the letterhead block.
    expect(text.indexOf('СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ')).toBeLessThan(60);
  });

  it('renders the full multi-clause body — several distinct section headings', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).toContain('КЕЛИШУВ ПРЕДМЕТИ');
    expect(text).toContain('МИКРОҚАРЗ/МИКРОКРЕДИТЛАР ГАРОВ ТАЪМИНОТИ');
    expect(text).toContain('ТОМОНЛАРНИНГ ҲУҚУҚ ВА МАЖБУРИЯТЛАРИ');
    expect(text).toContain('КЕЛИШУВНИНГ АМАЛ ҚИЛИШ МУДДАТИ');
  });

  it('does not leak a raw datetime (no GMT string, no HH:MM:SS)', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
  });

  it('appends the notarial-attestation block only when notary=true', () => {
    const c = mockCaseDoc();

    expect(flattenDocText(rklGenTemplate(c, true))).toContain('НОТАРИАЛ ТАСДИҚ');
    expect(flattenDocText(rklGenTemplate(c))).not.toContain('НОТАРИАЛ ТАСДИҚ');
  });
});
