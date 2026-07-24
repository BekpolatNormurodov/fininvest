/**
 * Product-specific dossier documents — the FEW extra papers an asset-purchase product needs on
 * top of the common generated set (contract, grafik, score report, ...). Cash products (OSON,
 * ADM TEAM) add nothing; the asset ones add only the essentials, and the asset itself is the
 * collateral, so there is no separate pledge object to document.
 *
 * These are UPLOAD slots (the operator attaches the real papers) — a checklist, not generated
 * legal text. The bodies of any new contracts are intentionally NOT authored here.
 */

import { LoanProduct } from './loan-product';

/** One extra document a product's dossier expects the operator to upload. */
export interface ProductUploadDoc {
  key: string;
  title: { uz: string; ru: string };
}

export const PRODUCT_EXTRA_DOCS: Record<LoanProduct, ProductUploadDoc[]> = {
  ADM_TEAM: [],
  OSON: [],
  AVTO: [
    { key: 'sale_contract', title: { uz: 'Oldi-sotdi shartnomasi', ru: 'Договор купли-продажи' } },
    { key: 'tech_passport', title: { uz: 'Tex passport', ru: 'Тех паспорт' } },
    { key: 'appraisal', title: { uz: 'Baholash akti', ru: 'Акт оценки' } },
    { key: 'kasko', title: { uz: 'KASKO sug\'urta polisi', ru: 'Полис КАСКО' } },
  ],
  IPOTEKA: [
    { key: 'sale_contract', title: { uz: 'Oldi-sotdi shartnomasi', ru: 'Договор купли-продажи' } },
    { key: 'cadastre', title: { uz: 'Kadastr / DDU', ru: 'Кадастр / ДДУ' } },
    { key: 'appraisal', title: { uz: 'Baholash akti', ru: 'Акт оценки' } },
    { key: 'property_insurance', title: { uz: 'Mulk sug\'urta polisi', ru: 'Страховой полис имущества' } },
  ],
};

/** The extra upload documents for a product (empty for cash products). */
export function productExtraDocs(product: LoanProduct): ProductUploadDoc[] {
  return PRODUCT_EXTRA_DOCS[product];
}
