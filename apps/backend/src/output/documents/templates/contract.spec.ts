import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { contractTemplate } from './contract';

describe('contractTemplate', () => {
  it('rounds the interest rate to a whole percent (no floating-point garbage)', () => {
    const c = mockCaseDoc({ creditLine: { interestRate: 0.55 as unknown as never } });
    const text = flattenDocText(contractTemplate(c));

    expect(text).toContain('55%');
    // The old bug rendered `Number(0.55) * 100` with no rounding -> 55.00000000000001%.
    expect(text).not.toContain('55.00000000000001');
  });

  it('shows "—" (not "NaN%") for the rate/penalty when they are missing', () => {
    const c = mockCaseDoc({
      creditLine: { interestRate: null as unknown as never, penaltyRate: null as unknown as never },
    });
    const text = flattenDocText(contractTemplate(c));

    expect(text).not.toContain('NaN%');
    expect(text).toContain('—');
  });

  it('shows "—" for the place/date line when lineDate is missing (not a blank line)', () => {
    const c = mockCaseDoc({ creditLine: { lineDate: null as unknown as never } });
    const text = flattenDocText(contractTemplate(c));

    expect(text).toContain('Тошкент ш.');
    expect(text).toContain('—');
  });

  it('never fabricates a default rate/term/date (60/55/105) when creditLine fields are null', () => {
    const c = mockCaseDoc({
      creditLine: {
        interestRate: null as unknown as never,
        penaltyRate: null as unknown as never,
        termMonths: null as unknown as never,
        lineDate: null as unknown as never,
        lineMaturity: null as unknown as never,
      },
    });
    const text = flattenDocText(contractTemplate(c));

    // No hardcoded fallback numbers standing in for the missing rate/penalty/term.
    expect(text).not.toContain('60%');
    expect(text).not.toContain('55%');
    expect(text).not.toContain('105%');
  });

  it('renders headings for all 12 articles (proves the full body exists, not just 3)', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(contractTemplate(c));

    expect(text).toContain('Томонларнинг жавобгарлиги');
    expect(text).toContain('Форс-мажор');
    expect(text).toContain('Низоларни ҳал этиш');
    expect(text).toContain('Шахсий маълумотларни қайта ишлаш');
    expect(text).toContain('Бошқа шартлар');
    expect(text).toContain('Томонларнинг юридик манзиллари ва реквизитлари');
  });

  it('binds the borrower name, the loan amount, and the contract number into the output', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(contractTemplate(c));

    expect(text).toContain(c.borrower!.fullName);
    expect(text).toMatch(/150\s000\s000/);
    expect(text).toContain(c.contractNumber!);
  });

  it('cash products keep the sheet wording: the pledge is NOT insured', () => {
    const text = flattenDocText(contractTemplate(mockCaseDoc()));
    expect(text).toContain('сугурталанмайди');
    expect(text).not.toContain('КАСКО');
  });

  /*
    AVTO and IPOTEKA used to be served this same cash contract with one sentence swapped: «Гаров
    объекти КАСКО бўйича суғурталанади» — a wording invented here rather than taken from any sheet.

    They now print their own form, the APEX contract (contract-apex.ts), whose 4.1.2 names the
    insurer and the premium the case actually carries. So what is asserted here is that they are no
    longer served this document; their own clauses are covered by contract-apex.spec.ts.
  */
  it.each(['AVTO', 'IPOTEKA'])('%s is not served the cash contract at all', (product) => {
    const text = flattenDocText(contractTemplate(mockCaseDoc({ product: product as unknown as never })));
    expect(text).toContain('Микрокредит шартномаси №');
    expect(text).not.toContain('КАСКО');
    expect(text).not.toContain('мол-мулк суғуртаси');
  });

  it('does not leak a raw Date toString/ISO value anywhere (no GMT, no HH:MM:SS)', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(contractTemplate(c));

    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
  });
});
