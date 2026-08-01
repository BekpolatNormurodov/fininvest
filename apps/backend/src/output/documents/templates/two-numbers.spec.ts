import { DOC_REGISTRY } from '../registry';
import { lineAgreementNo } from '../doc-layout';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';

/*
  A case carries two numbers, and the documents have to tell them apart.

  The бош келишув opens the microfinance line — «№ 0000 СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ
  КЕЛИШУВ» — and the shartnoma draws a tranche from it. The обложка heads the line agreement, the
  РКЛ Ген is the line agreement, and the приказ, акт and мониторинг all cite it in their own prose
  («…микромолиялаш линияси очиш тўғрисидаги Бош Келишувга асосан»). Only the contract carries the
  full «2012 MFL 1320 PS».

  All five used to end their expression with `?? c.contractNumber ?? c.number`, so when no line
  number was set they printed the contract number — one number under two different labels, on paper,
  looking correct. The negative assertions below are the point: they fail if that tail comes back.
*/
const CONTRACT_NO = '2012 MFL 1320 PS';
const YEARLY = '1320';

const render = (key: string, o?: Parameters<typeof mockCaseDoc>[0]) =>
  flattenDocText(DOC_REGISTRY[key]!.build(mockCaseDoc(o)));

const LINE_DOCS = ['obloshka', 'rklGen', 'prikaz', 'act', 'monitoring1', 'rklGenNotary'];

describe('lineAgreementNo', () => {
  it('is contractYearlyNo — the number the design assigned to the line', () => {
    expect(lineAgreementNo({ contractYearlyNo: 1320 })).toBe('1320');
  });

  it('lets a number an operator typed on an older case win', () => {
    expect(lineAgreementNo({ creditLine: { lineNumber: 'РКЛ-0042' }, contractYearlyNo: 1320 })).toBe('РКЛ-0042');
  });

  it('treats a blank typed number as absent rather than printing nothing', () => {
    expect(lineAgreementNo({ creditLine: { lineNumber: '  ' }, contractYearlyNo: 1320 })).toBe('1320');
  });

  it('says «—» when the case has no number yet, never the contract number', () => {
    expect(lineAgreementNo({ creditLine: null, contractYearlyNo: null })).toBe('—');
  });
});

describe('the two numbers land on the right documents', () => {
  it.each(LINE_DOCS)('%s carries the бош келишув number, not the contract number', (key) => {
    const t = render(key, { creditLine: { lineNumber: null as never, orderNumber: null as never } });
    expect(t).toContain(YEARLY);
    expect(t).not.toContain(CONTRACT_NO);
  });

  it('the contract carries the full contract number', () => {
    expect(render('contract')).toContain(CONTRACT_NO);
  });

  it('a number the operator typed still wins on every line document', () => {
    for (const key of LINE_DOCS) {
      const t = render(key, { creditLine: { lineNumber: 'РКЛ-0042' } });
      expect(t).toContain('РКЛ-0042');
      expect(t).not.toContain(CONTRACT_NO);
    }
  });

  /*
    A draft has no numbers at all — they are assigned at submit. It must say «—», not borrow the
    case's internal application id (A-000123), which is not a document number and means nothing to
    anyone holding the paper.
  */
  it('an unnumbered case prints «—», not the application id', () => {
    for (const key of LINE_DOCS) {
      const t = render(key, {
        contractNumber: null as never,
        contractYearlyNo: null as never,
        creditLine: { lineNumber: null as never, orderNumber: null as never },
      });
      expect(t).not.toContain('A-000123');
    }
  });
});
