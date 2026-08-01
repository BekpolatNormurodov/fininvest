import { DOC_REGISTRY } from '../registry';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { RKL_LINES } from './rkl-body';

/*
  The asset-product бош келишув, «РКЛ Ген» of «АВТО мфл APEX (2).xlsx».

  «ркл и договор узб изгарган шу экзели ичидан олиб коеш кере эди.» The contract was taken in first;
  this is the other half. Like the contract it turned out to be a different document rather than a
  revision — 40 clauses in the reference that our cash agreement does not carry — so the two live
  side by side and the product picks.

  The second describe is the one that matters: every static line the document prints has to be a
  line of RKL_LINES, which was machine-copied from the sheet. The wording is unfamiliar Uzbek
  legalese with the sheet's own misspellings in it, so a typo introduced by hand does not stand out
  on a read-through.
*/
const apex = (o?: Parameters<typeof mockCaseDoc>[0]) =>
  flattenDocText(DOC_REGISTRY['rklGen']!.build(mockCaseDoc({ product: 'AVTO' as never, ...(o ?? {}) })));

describe('the APEX бош келишув is used for asset products only', () => {
  it.each(['AVTO', 'IPOTEKA'])('%s gets the APEX body', (product) => {
    const t = flattenDocText(DOC_REGISTRY['rklGen']!.build(mockCaseDoc({ product: product as never })));
    expect(t).toContain('СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ КЕЛИШУВ');
    // Clauses that exist only in the APEX form.
    expect(t).toContain('S=L-D');
    expect(t).toContain('6. КЕЛИШУВНИНГ АМАЛ ҚИЛИШ МУДДАТИ');
    expect(t).toContain('7. ТОМОНЛАРНИНГ ЮРИДИК МАНЗИЛЛАРИ ВА РEКВИЗИТЛАРИ:');
  });

  it.each(['ADM_TEAM', 'OSON'])('%s keeps the cash agreement, untouched', (product) => {
    const t = flattenDocText(DOC_REGISTRY['rklGen']!.build(mockCaseDoc({ product: product as never })));
    expect(t).not.toContain('S=L-D');
  });

  it('a case with no product set keeps the cash agreement', () => {
    expect(flattenDocText(DOC_REGISTRY['rklGen']!.build(mockCaseDoc()))).not.toContain('S=L-D');
  });

  it('the notarial copy carries the APEX body plus the attestation', () => {
    const t = flattenDocText(DOC_REGISTRY['rklGenNotary']!.build(mockCaseDoc({ product: 'AVTO' as never })));
    expect(t).toContain('S=L-D');
    expect(t).toContain('НОТАРИАЛ ТАСДИҚ');
  });
});

describe('the APEX body is the sheet, not a retyping of it', () => {
  it('every static clause printed comes from RKL_LINES', () => {
    const printed = apex();
    const statics = RKL_LINES.filter((l) => l.kind !== 'slot').map((l) => (l as { text: string }).text);
    expect(statics.length).toBeGreaterThan(35);
    expect(statics.filter((t) => !printed.includes(t))).toEqual([]);
  });

  it("keeps the sheet's own spelling rather than correcting it", () => {
    const t = apex();
    expect(t).toContain('микрокқарз/микрокредит шартномалари');
    expect(t).toContain('хисобланмайди');
  });

  /*
    The sheet numbers two different clauses 2.5, and two 5.5. Copied as they are: renumbering them
    would make our document disagree with the one the office signs from.
  */
  it('reproduces the sheet\'s own repeated clause numbers', () => {
    const t = apex();
    expect(t).toContain('2.5.Қарз олувчи томонидан микроқарз');
    expect(t).toContain('2.5. Қонун ҳужжатларига мувофиқ');
    expect(t).toContain('5.5. Қарз олувчи томонидан тақдим этилган хужжатлар');
    expect(t).toContain('5.5. Ушбу Шартнома узбек тилида');
  });
});

describe('the six slots carry the case', () => {
  it('the title carries the бош келишув number, not the contract number', () => {
    const t = apex({ creditLine: { lineNumber: null as never } });
    expect(t).toContain('№ 1320 СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ');
    expect(t).not.toContain('2012 MFL 1320 PS');
  });

  it('1.1 prints the limit, the term in figures and words, and both dates', () => {
    const t = apex();
    expect(t).toContain('150 000 000,00 (Бир юз эллик миллион сўм 00 тийин) сўм миқдорида');
    expect(t).toContain('24 (Йигирма тўрт) ой муддатга');
    expect(t).toContain('05 Январь 2026 й. дан 05 Январь 2028 й. гача');
  });

  it('2.4 prints both rates in figures and words', () => {
    const t = apex();
    expect(t).toContain('йиллик – 55% (Эллик беш) фоиз');
    expect(t).toContain('йиллик 105% (Бир юз беш) фоизни');
  });

  it('3.1.1 uses the гаров wording for a car and the ипотека wording for property', () => {
    const t = apex();
    expect(t).toContain('русумли автомашинаси');
    expect(t).toContain('нотариал тасдиқланган гаров (ипотека) шартномаси');
  });

  it('3.1.2 names the insurer and the general agreement it was issued under', () => {
    const t = apex({
      creditLine: {
        insurance: {
          insured: true, company: 'АJ "APEX INSURANCE"',
          genAgreementNo: '1011/1407/1/2600937',
          genAgreementDate: new Date('2026-07-21T00:00:00.000Z'),
        } as never,
      },
    });
    expect(t).toContain('АJ "APEX INSURANCE"');
    expect(t).toContain('№1011/1407/1/2600937 сон билан');
  });

  /*
    «Если обеспечывается только автомобилем полис скрыть» — the sheet's own note to whoever fills
    it. An instruction, not a clause: it is obeyed, not printed.
  */
  /*
    With no insurer named the sheet's own A27 wording stands, and that cell is written throughout in
    the simplified spelling — «сугурта», «хар кандай», «микдоридан», «чикиб», with no қ or ҳ. Copied
    as it is: a sweep for «микдори» flags it, and the answer is that the form says микдори there.
  */
  it('the unnamed-insurer wording is the sheet\'s cell, spelling and all', () => {
    const t = apex({ creditLine: { insurance: { insured: true, company: null } as never } });
    expect(t).toContain('микрокарз/микрокредит микдоридан келиб чикиб белгиланади');
    expect(t).toContain('ММТ ни каноатлантирадиган хар кандай сугурта компанияси');
  });

  it('hides 3.1.2 on a car-only case with no policy, and never prints the operator note', () => {
    const t = apex({
      collaterals: [{ id: 'c1', type: 'AUTO', model: 'Chevrolet Cobalt', agreedValue: 180_000_000, owners: [] }] as never,
      creditLine: { insurance: null as never },
    });
    expect(t).not.toContain('3.1.2');
    expect(t).not.toContain('полис скрыть');
  });

  it('never prints NaN or a fabricated rate when the line is empty', () => {
    const t = apex({
      creditLine: {
        interestRate: null as never, penaltyRate: null as never, termMonths: null as never,
        lineDate: null as never, lineMaturity: null as never, amountTotal: null as never,
      },
      amount: null as never,
    });
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('55%');
    expect(t).not.toContain('105%');
  });
});

describe('article 7 is the live organisation, not the sheet\'s copy of it', () => {
  it('prints the requisites from the Organization record', () => {
    const t = apex();
    expect(t).toContain('«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ');
    expect(t).toContain('№ 2021 6000 8073 0412 2001');
    expect(t).toContain('90-000-79-25');
    expect(t).toContain('70-224-00-60');
  });

  // The бош келишув writes the bank without «в»; the contract writes it with. Each sheet as it reads.
  it('writes the MFO line the way this sheet writes it', () => {
    expect(apex()).toContain('МФО: №01196 «APEX BANK» АЖ');
  });

  it('follows the organisation when it changes', () => {
    const t = apex({ organization: { nameUpper: '«BOSHQA MTO» МЧЖ', inn: '999 111 222' } });
    expect(t).toContain('«BOSHQA MTO» МЧЖ');
    expect(t).not.toContain('СТИР: 312 356 239');
  });
});
