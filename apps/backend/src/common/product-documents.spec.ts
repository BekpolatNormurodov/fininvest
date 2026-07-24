import { LoanProduct, productExtraDocs, PRODUCT_EXTRA_DOCS } from '@credit-core/shared';

describe('product extra documents', () => {
  it('cash products add no extra documents', () => {
    expect(productExtraDocs(LoanProduct.ADM_TEAM)).toEqual([]);
    expect(productExtraDocs(LoanProduct.OSON)).toEqual([]);
  });

  it('avto expects the car papers including KASKO', () => {
    const keys = productExtraDocs(LoanProduct.AVTO).map((d) => d.key);
    expect(keys).toEqual(['sale_contract', 'tech_passport', 'appraisal', 'kasko']);
  });

  it('ipoteka expects the property papers including cadastre and property insurance', () => {
    const keys = productExtraDocs(LoanProduct.IPOTEKA).map((d) => d.key);
    expect(keys).toEqual(['sale_contract', 'cadastre', 'appraisal', 'property_insurance']);
  });

  it('keeps the set lean — no product asks for more than four extras', () => {
    for (const p of Object.values(LoanProduct)) {
      expect(PRODUCT_EXTRA_DOCS[p].length).toBeLessThanOrEqual(4);
    }
  });

  it('every extra doc carries both uz and ru titles', () => {
    for (const p of Object.values(LoanProduct)) {
      for (const d of PRODUCT_EXTRA_DOCS[p]) {
        expect(d.title.uz.length).toBeGreaterThan(0);
        expect(d.title.ru.length).toBeGreaterThan(0);
      }
    }
  });
});
