# Asset-Product Documents Fidelity — Implementation Plan

> **For agentic workers:** Execute inline (executing-plans). Steps use checkbox (`- [ ]`).

**Goal:** Make FinInvest's generated documents product-correct for AVTO/IPOTEKA (insurance stated, asset-purchase filing rows), while leaving cash (ADM/OSON) documents byte-identical.

**Architecture:** Add one shared helper that returns an asset product's insurance name (Cyrillic) or null for cash. Every template change branches on that helper being non-null (⇔ `isAsset`); the cash/legacy path is unchanged.

**Tech Stack:** NestJS backend, pdfmake templates, `@credit-core/shared` (consumed from dist — rebuild after editing), Jest.

## Global Constraints
- ADM_TEAM / OSON / legacy (no `c.product`) generated docs MUST stay byte-identical. Existing specs `excel-parity.spec.ts`, `render-db.spec.ts`, `act.spec.ts`, `cheklist.spec.ts`, `schedule-excel.spec.ts` MUST stay green.
- Do NOT invent full legal paragraphs — minimal factual Cyrillic wording, mark `// TODO(legal)`.
- `@credit-core/shared` edits require `npm run build -w @credit-core/shared` before backend tsc/tests see them.
- No `git push`. Commits local.

---

### Task 1: Shared helper `assetInsuranceLabelCyr`

**Files:** Modify `packages/shared/src/product-documents.ts`; Test `apps/backend/src/common/product-documents.spec.ts` (existing).

**Produces:** `assetInsuranceLabelCyr(product: LoanProduct | null): string | null` — `'КАСКО'` for AVTO, `'мол-мулк суғуртаси'` for IPOTEKA, `null` for ADM_TEAM/OSON/null.

- [ ] Add to `product-documents.ts`:
```ts
import { InsuranceKind, LoanProduct, loanProductProfile } from './loan-product';

/** Cyrillic insurance name for an asset product's collateral (KASKO / property); null for cash. */
export function assetInsuranceLabelCyr(product: LoanProduct | null | undefined): string | null {
  if (!product) return null;
  const kind = loanProductProfile(product).insurance;
  if (kind === InsuranceKind.CAR) return 'КАСКО';
  if (kind === InsuranceKind.PROPERTY) return 'мол-мулк суғуртаси';
  return null;
}
```
(Check existing imports in the file; reuse if `loanProductProfile`/`InsuranceKind` already imported.)
- [ ] `npm run build -w @credit-core/shared` → exit 0.
- [ ] Add a test asserting AVTO→'КАСКО', IPOTEKA→'мол-мулк суғуртаси', ADM_TEAM→null, null→null. Run `npx jest product-documents` → PASS.
- [ ] Commit.

---

### Task 2: Contract states the asset IS insured (asset-only)

**Files:** Modify `apps/backend/src/output/documents/templates/_collateral.ts` (~307), `templates/contract.ts` (~155). Test: `apps/backend/src/output/documents/__render__/*` (add asset assertion, see Task 6).

**Consumes:** `assetInsuranceLabelCyr` (Task 1).

- [ ] In `_collateral.ts` `contractCollateralProse`, import `assetInsuranceLabelCyr`, and replace the hardcoded final sentence `Гаров объекти сугурталанмайди.` with:
```ts
const insCyr = assetInsuranceLabelCyr(c.product as LoanProduct | null);
const insuranceSentence = insCyr
  ? `Гаров объекти ${insCyr} бўйича суғурталанади.` // TODO(legal): yakuniy so'zlashuvni tasdiqlang
  : 'Гаров объекти сугурталанмайди.';
```
and use `insuranceSentence` in place of the literal. Cash/legacy → `insCyr === null` → identical string.
- [ ] In `contract.ts` 3.1.2, when `!insurance?.insured`, branch on the same helper:
```ts
const insCyr = assetInsuranceLabelCyr(c.product as LoanProduct | null);
// ...inside the else branch:
insCyr
  ? `3.1.2  Гаров объекти ${insCyr} бўйича суғурталанади.` // TODO(legal)
  : '3.1.2  Кредит бўйича суғурта расмийлаштирилмаган. Гаров объекти сугурталанмайди.'
```
Keep the `insurance?.insured` branch untouched. Cash/legacy → identical.
- [ ] `npx tsc --noEmit` (backend) → 0. Commit.

---

### Task 3: Insurance line shown for asset products (asset-only)

**Files:** Modify `templates/credit-application.ts` (~93), `templates/petition.ts` (~52).

**Consumes:** `assetInsuranceLabelCyr`.

- [ ] In `credit-application.ts`, the block currently gated by `if (!isAutoOnly(c))` printing the LOAN_RISK policy line. Add an asset branch BEFORE it:
```ts
const insCyr = assetInsuranceLabelCyr(c.product as LoanProduct | null);
if (insCyr) {
  content.push(p(`Гаров объекти ${insCyr} бўйича суғурталанади.`, 8)); // TODO(legal)
} else if (!isAutoOnly(c)) {
  content.push(p(`Суғурта компаниясининг кредит қайтмаслилиги хавфи полиси. Суғурта полисининг қиймати ${moneyWithWordsCyr(insuredSum)}.`, 8));
}
```
Cash/legacy → `insCyr === null` → falls to the existing `!isAutoOnly` branch, identical.
- [ ] Apply the same asset-branch pattern in `petition.ts` around its `!isAutoOnly` insurance line (mirror the existing wording there for the cash branch; only add the leading `if (insCyr) {...} else if (!isAutoOnly...)`).
- [ ] Backend `tsc --noEmit` → 0. Commit.

---

### Task 4: Filing checklist rows for asset products (asset-only)

**Files:** Modify `templates/cheklist.ts`. Test: `templates/cheklist.spec.ts` (must stay green for cash; add asset case).

- [ ] Keep the static `ITEMS` (16 rows) as the CASH list, unchanged. Add an asset extension and select by product:
```ts
import { assetInsuranceLabelCyr } from '@credit-core/shared';
// ...
const ASSET_ITEMS: { name: string; copies: string }[] = [
  { name: 'Олди-сотди шартномаси', copies: '1' },
  { name: 'Тех. паспорт / кадастр', copies: '1' },
  { name: 'Бахолаш далолатномаси', copies: '1' },
  { name: 'Суғурта полиси (КАСКО / мол-мулк)', copies: '1' },
  { name: 'Бошланғич тўлов квитанцияси', copies: '1' },
];
```
In `cheklistTemplate(_c)` → `cheklistTemplate(c)`: `const isAsset = assetInsuranceLabelCyr(c.product as any) !== null; const items = isAsset ? [...baseCommon, ...ASSET_ITEMS] : ITEMS;` where for asset we drop the cash-pledge-only rows (`Гаров Шартномаси`, `Бахолаш далолатномаси` duplicate, `Таъкик варақаси`) and keep the shared ones. Simplest safe approach: for asset, use `ITEMS.filter(i => !['Гаров Шартномаси','Таъкик варақаси'].includes(i.name)).concat(ASSET_ITEMS)`. Cash → exactly `ITEMS`.
- [ ] Remove the `// eslint-disable ... no-unused-vars` and use `c`.
- [ ] Verify `cheklist.spec.ts` (cash) still passes; add a case asserting asset list contains 'Олди-сотди шартномаси' and 'Суғурта полиси (КАСКО / мол-мулк)'. Run → PASS.
- [ ] Commit.

---

### Task 5: Registry product filter (asset-only exclusion)

**Files:** Inspect `documents/registry.ts` and `apps/backend/src/output/case-documents.controller.ts`. Modify whichever builds the offered-doc list.

- [ ] Read both files. If `DOC_REGISTRY` entries have a natural place for an `appliesTo?: 'cash' | 'asset' | 'both'` flag (default `'both'`), add it and filter the list by `c.product` (asset ⇒ exclude `'cash'`, cash/legacy ⇒ exclude `'asset'`). If the registry is a flat static map consumed directly, add the filter at the controller where the per-case list is assembled, keyed on `assetInsuranceLabelCyr(c.product) !== null`.
- [ ] Minimal first cut: exclude the pure-pledge valuation doc (`act` / «Акт согласования») for asset cases only; leave everything else. Confirm cash list is unchanged.
- [ ] Backend `tsc --noEmit` → 0. Commit.

---

### Task 6: Regression + asset render assertions

**Files:** `apps/backend/src/output/documents/__render__/*.spec.ts`.

- [ ] Run the full regression set: `npx jest excel-parity render-db act cheklist schedule-excel product-documents` → all PASS (cash byte-identical).
- [ ] Add/confirm an asset render assertion: a rendered AVTO contract text does NOT contain «сугурталанмайди» and DOES contain «КАСКО»; an IPOTEKA contract contains «мол-мулк суғуртаси». (Use the existing render harness pattern in `render-db.spec.ts`.)
- [ ] Run → PASS. Commit.

## Self-Review
- Spec coverage: Task 2 = contract clause; Task 3 = insurance line; Task 4 = cheklist; Task 5 = registry; helper Task 1; regression Task 6. All spec components mapped.
- Cash byte-identical: every change gated on `assetInsuranceLabelCyr(...) !== null` (null for cash/legacy) → cash path unchanged.
- Legal text: only `// TODO(legal)`-marked minimal sentences added.
