import { DOC_REGISTRY } from '../registry';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';

/*
  The lender's requisites block, checked against «АВТО мфл APEX (2).xlsx» line by line.

  These lines are the firm's legal identity on a signed document, and three of them were wrong or
  missing before: the bosh kelishuv printed the account without its «№» and the MFO without saying
  which bank it belongs to, and neither document carried the second phone number.

  The contract and the bosh kelishuv word the bank line differently — the contract has «в» before
  the bank's name, the bosh kelishuv does not. That is how each sheet reads, so both are asserted
  rather than normalised to one.
*/
describe('lender requisites, as the reference prints them', () => {
  const render = (key: string) => flattenDocText(DOC_REGISTRY[key]!.build(mockCaseDoc()));

  it.each(['contract', 'rklGen'])('%s carries the identity lines', (key) => {
    const t = render(key);
    expect(t).toContain('«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ');
    expect(t).toContain('Тошкент шахар, Чилонзор тумани, Катта Чилонзор-3 МФЙ Чилонзор кучаси 82в-уй');
    expect(t).toContain('312 356 239');
    expect(t).toContain('Таджибаев А.Ю');
  });

  it.each(['contract', 'rklGen'])('%s prints the account with its № and both phone numbers', (key) => {
    const t = render(key);
    expect(t).toContain('№ 2021 6000 8073 0412 2001');
    expect(t).toContain('90-000-79-25');
    expect(t).toContain('70-224-00-60');
  });

  it('names the bank on the MFO line, each sheet in its own wording', () => {
    expect(render('rklGen')).toContain('МФО: №01196 «APEX BANK» АЖ');
    expect(render('contract')).toContain('МФО: №01196 в «APEX BANK» АЖ');
  });

  it('does not double the № — the value is stored without one', () => {
    for (const key of ['contract', 'rklGen']) {
      expect(render(key)).not.toContain('№№');
      expect(render(key)).not.toContain('№ №');
    }
  });

  it('leaves no trace of the previous lender', () => {
    for (const key of Object.keys(DOC_REGISTRY)) {
      const t = render(key);
      expect(t).not.toContain('CLEVER');
      expect(t).not.toContain('PULMAKON');
      expect(t).not.toContain('ANORBANK');
    }
  });
});
