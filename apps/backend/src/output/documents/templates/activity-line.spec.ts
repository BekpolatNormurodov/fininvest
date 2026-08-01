import { DOC_REGISTRY } from '../registry';
import { activityLine } from './_shared';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';

/*
  «оз озини банд колган дб кириткканмиз шуни тортиш кере.»

  A client entered as self-employed — «O'Z O'ZINI BAND QILGAN №12588» — did not come through. One
  workbook cell, Д1!C36, feeds three forms, and each of them answered it differently:

    анкета              «Фаолият жойи»        = employer only     → self-employed printed «—»
    score report        «Фаолият тури»        = certificate first
    credit application  «Асосий фаолият жойи» = employer first, with `??`, so an employer stored as
                                                '' hid the certificate behind it

  The last test is the one that matters: it asserts the three agree, which is a property no
  per-document test can check.
*/
const SELF = { entrepreneurType: "O'Z O'ZINI BAND QILGAN", entrepreneurCertNo: '12588' };
const SELF_LINE = "O'Z O'ZINI BAND QILGAN № 12588";
const ACTIVITY_DOCS = ['clientProfile', 'creditApplication', 'scoreReport'];

describe('activityLine', () => {
  it('prefers the entrepreneur status, which is what a self-employed client has instead of an employer', () => {
    expect(activityLine({ borrower: SELF, employment: { employer: 'MCHJ SAMPLE' } } as never)).toBe(SELF_LINE);
  });

  it('falls back to the workplace when there is no certificate', () => {
    expect(activityLine({ borrower: {}, employment: { employer: 'MCHJ SAMPLE' } } as never)).toBe('MCHJ SAMPLE');
  });

  it('treats a blank employer as absent instead of letting it end the chain', () => {
    expect(activityLine({ borrower: SELF, employment: { employer: '   ' } } as never)).toBe(SELF_LINE);
    expect(activityLine({ borrower: {}, employment: { employer: '  ' } } as never)).toBe('—');
  });

  it('prints the status without a stray «№» when there is no certificate number', () => {
    expect(activityLine({ borrower: { entrepreneurType: "O'Z O'ZINI BAND QILGAN" } } as never))
      .toBe("O'Z O'ZINI BAND QILGAN");
  });
});

describe('a self-employed client appears on every form that asks what they do', () => {
  it.each(ACTIVITY_DOCS)('%s prints the self-employment status', (key) => {
    const t = flattenDocText(DOC_REGISTRY[key]!.build(
      mockCaseDoc({ borrower: SELF as never, employment: { employer: null as never } }),
    ));
    expect(t).toContain(SELF_LINE);
  });

  it.each(ACTIVITY_DOCS)('%s prints the workplace for an employed client', (key) => {
    const t = flattenDocText(DOC_REGISTRY[key]!.build(
      mockCaseDoc({
        borrower: { entrepreneurType: null as never, entrepreneurCertNo: null as never },
        employment: { employer: 'MCHJ "SAMPLE TRADE"' },
      }),
    ));
    expect(t).toContain('MCHJ "SAMPLE TRADE"');
  });

  /*
    The three read one cell, so they must not be able to disagree. This is what actually broke: each
    document was correct read on its own and they contradicted each other in the same dossier.
  */
  it('the three forms never disagree about what the client does', () => {
    const combos = [
      { borrower: SELF, employment: { employer: 'MCHJ SAMPLE' } },
      { borrower: SELF, employment: { employer: null } },
      { borrower: SELF, employment: { employer: '' } },
      { borrower: { entrepreneurType: null, entrepreneurCertNo: null }, employment: { employer: 'MCHJ SAMPLE' } },
    ];
    for (const o of combos) {
      const c = mockCaseDoc(o as never);
      const expected = activityLine(c);
      for (const key of ACTIVITY_DOCS) {
        expect(flattenDocText(DOC_REGISTRY[key]!.build(c))).toContain(expected);
      }
    }
  });
});
