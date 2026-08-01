import { DOC_REGISTRY } from '../registry';
import { cyrillicPicklist } from '../doc-layout';
import { ENTREPRENEUR_TYPES, NATIONALITY_UZ } from '@credit-core/shared';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';

/*
  «где то лотинча где то кирил.»

  The forms are Uzbek Cyrillic. Two of the wizard's dropdowns are Latin constants in code, and both
  print into those forms — the entrepreneur status into «Фаолият жойи» on three documents, the
  nationality into «фуқаролиги» on the анкета.

  Translated at print time rather than at the source on purpose: rows already in the database hold
  the Latin strings, and editing the constant would fix new cases while leaving every existing one
  printing Latin.

  Two things are deliberately NOT asserted here. The «Протокол» is Latin in the reference workbook
  itself — measured, 95 Cyrillic characters against 2553 Latin across 30 sheets — so a Latin
  protokol is the form, not a bug. And the firm's own name, «FINCOM INVEST» MIKROMOLIYA TASHKILOTI,
  is Latin because that is how it is registered.
*/
describe('cyrillicPicklist', () => {
  it.each([...ENTREPRENEUR_TYPES])('translates the stored value %s', (v) => {
    expect(cyrillicPicklist(v)).toMatch(/^[Ѐ-ӿ\s]+$/);
  });

  it('translates every nationality the picklist offers', () => {
    for (const name of Object.values(NATIONALITY_UZ)) {
      const out = cyrillicPicklist(name) as string;
      expect(out).toMatch(/^[Ѐ-ӿ\s]+$/);
    }
  });

  it('accepts the three apostrophes a keyboard can produce for one answer', () => {
    for (const v of ['O‘zbekiston Respublikasi', "O'zbekiston Respublikasi", 'Ozbekiston Respublikasi']) {
      expect(cyrillicPicklist(v)).toBe('Ўзбекистон Республикаси');
    }
  });

  it('leaves anything that is not a picklist value alone', () => {
    // A name, an employer, a hand-typed sector — this translates a closed list, not Uzbek.
    expect(cyrillicPicklist('MCHJ "SAMPLE TRADE"')).toBe('MCHJ "SAMPLE TRADE"');
    expect(cyrillicPicklist('QODIROV ALISHER')).toBe('QODIROV ALISHER');
    expect(cyrillicPicklist(null)).toBeNull();
    expect(cyrillicPicklist(undefined)).toBeUndefined();
  });
});

describe('the picklists reach the documents in Cyrillic', () => {
  const withLatin = () =>
    mockCaseDoc({
      borrower: {
        entrepreneurType: 'Yakka tartibdagi tadbirkor',
        entrepreneurCertNo: '00114455',
        citizenship: 'O‘zbekiston Respublikasi',
      } as never,
      employment: { employer: null as never },
    });

  it.each(['clientProfile', 'creditApplication', 'scoreReport'])(
    '%s prints the entrepreneur status in Cyrillic even on a row stored in Latin',
    (key) => {
      const t = flattenDocText(DOC_REGISTRY[key]!.build(withLatin()));
      expect(t).toContain('Якка тартибдаги тадбиркор');
      expect(t).not.toContain('Yakka tartibdagi tadbirkor');
    },
  );

  it('the анкета prints the nationality in Cyrillic', () => {
    const t = flattenDocText(DOC_REGISTRY['clientProfile']!.build(withLatin()));
    expect(t).toContain('Ўзбекистон Республикаси');
    expect(t).not.toContain('O‘zbekiston Respublikasi');
  });
});

describe('the watermark is in the documents alphabet', () => {
  // 12mm bold at 45° across the middle of every page of every document — the most visible string
  // we print, and it was the one in Latin.
  it.each(['MODERATION', 'FINALIZED', 'REJECTED'])('a %s case is watermarked in Cyrillic', (status) => {
    const t = flattenDocText(DOC_REGISTRY['contract']!.build(mockCaseDoc({ status: status as never })));
    for (const latin of ['TASDIQLANMAGAN', 'TASDIQLANGAN', 'RAD ETILGAN', 'BEKOR QILINGAN']) {
      expect(t).not.toContain(latin);
    }
  });
});

describe('the signature marker is one word, not two', () => {
  it('every document that marks a signature line uses «(имзо)»', () => {
    for (const key of Object.keys(DOC_REGISTRY)) {
      const t = flattenDocText(DOC_REGISTRY[key]!.build(mockCaseDoc()));
      expect(t).not.toContain('(imzo)');
    }
  });

  it('and the APEX contract too — it has its own requisites block', () => {
    const t = flattenDocText(DOC_REGISTRY['contract']!.build(mockCaseDoc({ product: 'AVTO' as never })));
    expect(t).toContain('(имзо)');
    expect(t).not.toContain('(imzo)');
  });
});
