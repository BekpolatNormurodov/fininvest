import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { contractTemplate } from './contract';
import { CONTRACT_LINES } from './contract-body';

/*
  The asset-product contract, «договор узб» of «АВТО мфл APEX (2).xlsx».

  Two things are asserted here, and the second matters more than the first.

  The first is that the right form is chosen: AVTO and IPOTEKA get the APEX contract, ADM TEAM and
  OSON keep the cash one. They are different documents — 14 articles against 12 — not two revisions
  of one, so choosing wrongly hands the client a contract for a product they did not take.

  The second is that no clause of the APEX body was ever retyped. Every static line the document
  prints has to be a line of CONTRACT_LINES, which was machine-copied from the sheet. A typo
  introduced by hand in a signed contract is not caught by reading it — the wording is unfamiliar
  Uzbek legalese and the sheet has its own misspellings, so a fresh one blends in.
*/

const apex = (o?: Parameters<typeof mockCaseDoc>[0]) =>
  flattenDocText(contractTemplate(mockCaseDoc({ product: 'AVTO' as never, ...(o ?? {}) })));

describe('the APEX contract is used for asset products only', () => {
  it.each(['AVTO', 'IPOTEKA'])('%s gets the APEX body', (product) => {
    const t = flattenDocText(contractTemplate(mockCaseDoc({ product: product as never })));
    expect(t).toContain('Микрокредит шартномаси №');
    // Articles 12 and 13 exist only in the APEX form.
    expect(t).toContain('12. Махфийлик');
    expect(t).toContain('13. Бошқа шартлар');
    expect(t).toContain('14. Томонларнинг юридик манзиллари ва реквизитлари');
  });

  it.each(['ADM_TEAM', 'OSON'])('%s keeps the cash contract, untouched', (product) => {
    const t = flattenDocText(contractTemplate(mockCaseDoc({ product: product as never })));
    expect(t).toContain('11. Бошқа шартлар');
    expect(t).toContain('12. Томонларнинг юридик манзиллари ва реквизитлари');
    expect(t).not.toContain('13. Бошқа шартлар');
    expect(t).not.toContain('Микрокредит шартномаси №');
  });

  it('a case with no product set keeps the cash contract', () => {
    const t = flattenDocText(contractTemplate(mockCaseDoc()));
    expect(t).toContain('12. Томонларнинг юридик манзиллари ва реквизитлари');
    expect(t).not.toContain('13. Бошқа шартлар');
  });
});

describe('the APEX body is the sheet, not a retyping of it', () => {
  it('every static clause printed comes from CONTRACT_LINES', () => {
    const printed = apex();
    const statics = CONTRACT_LINES.filter((l) => l.kind !== 'slot')
      .map((l) => (l as { text: string }).text)
      // Article 14 is the live organisation record, not the sheet's frozen copy — asserted below.
      .filter((t) => !t.startsWith('14.') && !/^(«|Манзил:|х\/р|МФО|СТИР|Тел|Ижрочи|Таджибаев)/.test(t));
    expect(statics.length).toBeGreaterThan(100);
    const missing = statics.filter((t) => !printed.includes(t));
    expect(missing).toEqual([]);
  });

  it('keeps the sheet\'s own spelling rather than correcting it', () => {
    const t = apex();
    expect(t).toContain('накд пул ва/еки пул утказмаси');
    expect(t).toContain('6. Микромолия ташкилотининг мажуриятлари');
  });
});

describe('the ten slots carry the case', () => {
  it('prints the contract number in the title', () => {
    expect(apex()).toContain('Микрокредит шартномаси № 2012 MFL 1320 PS');
  });

  it('1.1 prints the amount in figures and words, and the two dates', () => {
    const t = apex();
    expect(t).toContain('150 000 000,00 (Бир юз эллик миллион сўм 00 тийин) билан Микрокредитни');
    expect(t).toContain('05 Январь 2026 й. дан 05 Январь 2028 гача');
    // The suffix belongs to the sheet's own sentence — the shared helper's «сўм» must not double it.
    expect(t).not.toContain('00 тийин) сўм билан');
  });

  it('2.4 prints the penalty rate and 3.1 the interest rate in figures and words', () => {
    const t = apex();
    expect(t).toContain('йиллик 105% миқдорида фоизларни ундиради');
    expect(t).toContain('йиллик 55% (Эллик беш %)');
  });

  it('3.1.1 names a гаров шартномаси for a car and an ипотека шартномаси for property', () => {
    const t = apex();
    expect(t).toContain('русумли автомашинаси');
    expect(t).toContain('нотариал тасдиқланган гаров шартномаси билан белгиланади');
    expect(t).toContain('нотариал тасдиқланган ипотека шартномаси билан белгиланади');
  });

  it('4.1.2 prints the policy sum, falling back to the line\'s полис amount', () => {
    expect(apex({ creditLine: { insurance: { insured: true, company: 'АJ "APEX INSURANCE"', insuredSum: 26_000_000 } as never } }))
      .toContain('АJ "APEX INSURANCE" суғурта компаниясининг кредит қайтмаслилиги хавфи полиси');
    // No insurance record, but the line carries a полис amount — the money is real, so it is printed.
    expect(apex()).toContain('Сугурта полисининг киймати 10 000 000,00');
  });

  it('says so plainly when there is no policy at all, instead of a sum of «—»', () => {
    const t = apex({ creditLine: { amountPolis: null as never, insurance: null as never } });
    expect(t).toContain('4.1.2  Кредит қайтмаслилиги хавфи полиси расмийлаштирилмаган.');
    expect(t).not.toContain('киймати — сум');
  });

  it('never prints NaN or a fabricated rate when the line is empty', () => {
    const t = apex({
      creditLine: {
        interestRate: null as never, penaltyRate: null as never,
        lineDate: null as never, lineMaturity: null as never, amountTotal: null as never,
      },
    });
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('55%');
    expect(t).not.toContain('105%');
  });
});

describe('article 14 is the live organisation, not the sheet\'s copy of it', () => {
  it('prints the requisites from the Organization record', () => {
    const t = apex();
    expect(t).toContain('«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ');
    expect(t).toContain('№ 2021 6000 8073 0412 2001');
    expect(t).toContain('МФО: №01196 в «APEX BANK» АЖ');
    expect(t).toContain('90-000-79-25');
    expect(t).toContain('70-224-00-60');
  });

  it('follows the organisation when it changes, rather than the frozen sheet text', () => {
    const t = apex({ organization: { nameUpper: '«BOSHQA MTO» МЧЖ', inn: '999 111 222' } });
    expect(t).toContain('«BOSHQA MTO» МЧЖ');
    expect(t).toContain('СТИР: 999 111 222');
    expect(t).not.toContain('СТИР: 312 356 239');
  });

  it('prints the borrower side with the PINFL', () => {
    const t = apex();
    expect(t).toContain('ЖЎЛДИБАЕВ РУСЛАН');
    expect(t).toContain('ЖШШИР: 52101901234567');
  });
});
