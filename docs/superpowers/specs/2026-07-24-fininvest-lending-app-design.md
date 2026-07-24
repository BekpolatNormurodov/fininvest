# fin-invest — Multi-product Lending App Design

**Status:** Approved design (brainstorming complete). Next step: implementation plan.
**Date:** 2026-07-24
**Author:** Bekpolat Normurodov (with Claude)

## Goal

A new, separately-deployed lending product — `fin-invest` (domain **fininvest.uz**) —
built on the credit-core foundation. It handles **four credit products** with distinct
rules, a **seller/distributor** party for asset-purchase loans, down-payment / LTV
mechanics, product-specific insurance and documents, and product-aware scoring — while
reusing credit-core's scoring engine, UI kit, API client, E-IMZO signing, document
system and role workflow.

This document is the design (spec). It lives in the credit-core repo because fin-invest
does not yet exist; creating the fin-invest repo is the first implementation task.

## Relationship to credit-core

fin-invest is a **separate git repository**, not a fork and not a folder inside
credit-core. Its own stack: backend + web + MySQL + nginx, own domain, own SSL.

### What is shared vs adapted

- **Shared, single-source (via git submodule of credit-core):**
  `@credit-core/shared` (scoring, enums, dto, origination tables, collateral-owner),
  `@credit-core/ui`, `@credit-core/api-client`. These are consumed as npm-workspace
  packages pointing at the submodule path, so scoring/UI/dto never diverge between the
  two products. A fix in credit-core's scoring flows to fin-invest by updating the
  submodule ref.
- **Adapted (credit-core keeps these inside `apps/backend`, they are not packages):**
  workflow state machine, E-IMZO signing wiring, document registry/templates, Prisma
  schema. fin-invest's backend is modeled on credit-core's backend, importing every
  shareable unit from the submodule packages and re-using credit-core's proven modules
  where they can be copied cleanly. Extracting these NestJS modules into shared packages
  is a **future improvement**, out of scope for v1.

### fin-invest repo structure (target)

```
fin-invest/
  vendor/credit-core/          git submodule → the credit-core repo
  packages/                    fin-invest-specific shared code (product profiles, seller)
  apps/backend/                NestJS + Prisma (product/seller/LTV model + workflow)
  apps/web-operator/           new-ariza → product picker → per-product wizard
  apps/web-moderator/
  apps/web-director/           E-IMZO signing
  apps/web-admin/
  deploy/nginx/                server_name fininvest.uz, own SSL
```

The role apps mirror credit-core (operator → moderator → director → admin) so the
signing and finalize stages carry over unchanged.

## The four products

Each product is a **parameter profile** over one shared engine. OSON and ADM TEAM are
**separate products** (distinct rules), not a merged "cash" bucket.

| Product | Kind | Down payment | Rate | Max term | Collateral | Seller | Insurance |
|---|---|---|---|---|---|---|---|
| `ADM_TEAM` | cash | — | from 32% | ≤ 36 mo | separate pledge, ≥140% coverage | none | loan-risk |
| `OSON` | cash | — | up to 50% | config (default ≤ 24 mo) | separate pledge, ≥140% | none | loan-risk |
| `AVTO` | asset-purchase | 30% | config | config (mid, default ≤ 36 mo) | the car itself (LTV) | egasi / avtosalon / MKO | car (KASKO) |
| `IPOTEKA` | asset-purchase | 30–40% | config | config (long, default ≤ 120 mo) | the property itself (LTV) | uy egasi / Xonsaroy | property |

Values marked "config" are stored as a per-product configuration with the sensible
defaults shown; the operator/business can adjust them without code changes. The fixed
values (ADM TEAM 32% / 36 months, OSON ≤ 50%, down payments 30–40% / 30%) come from the
business owner and are seeded as defaults.

### Term band (short vs long) — derived, never picked

The user never selects краткосрочный/долгосрочный. It is computed from the entered term:
`termBand = termMonths <= SHORT_TERM_MAX ? SHORT : LONG` with `SHORT_TERM_MAX = 12`
(config). The wizard shows the resulting band as a label in the header once the term is
entered.

## Data model additions (Prisma, fin-invest backend)

- `Product` enum: `ADM_TEAM | OSON | AVTO | IPOTEKA`.
- `TermBand` enum: `SHORT | LONG` (derived, persisted for reporting).
- On the credit case: `product`, `termBand`, `downPaymentPct?`, `ltvPct?`,
  `downPaymentToSeller` (bool, always true for asset products — see disbursement).
- `Seller` model (the distributor):
  - `kind`: `INDIVIDUAL | LEGAL`
  - individual: fullName, pinfl, passport (series/number/issuedBy/issuedAt), address, phone
  - legal: orgName, stir (INN), directorName, legalAddress, phone
  - both: bank requisites (account/card, bankName, mfoCode), ownership document ref
  - `isCatalog` (bool): frequent legal sellers (Xonsaroy, dealers) are saved once and
    reused; individual sellers are entered per case.
- `ProductConfig` (seeded): per-product rate floors/caps, max term, min down payment,
  collateral rule, insurance type.

## Seller / distributor

- Asset-purchase products (AVTO, IPOTEKA) require a seller. Cash products (OSON, ADM
  TEAM) have no seller.
- Field set switches on `kind` (individual vs legal), per the table above.
- **Ownership validation (non-blocking):** the seller's name should match the asset
  owner on the cadastre (property) or tech passport (car). Mismatch raises a warning,
  not a hard block — resolved at a later review stage, consistent with how scoring does
  not gate the workflow. Reuses `resolveOwners` logic from `@credit-core/shared`.
- Legal sellers can be picked from a saved catalog; a one-time partnership agreement with
  the firm is assumed to exist outside the per-case flow.

## Down payment & disbursement

- Down payment percentage is a per-product minimum (config); the operator enters the
  actual amount, and the system computes LTV (`ltv = loan / assetValue`).
- If the entered down payment is **below** the product minimum, the case is flagged
  (warning), not blocked.
- **Down payment goes directly to the seller** (business decision). The client pays the
  seller directly; a receipt confirms it. MFO disburses only the remaining amount to the
  seller's account after: contracts signed → pledge registered (or DDU registered for
  new builds) → down-payment receipt confirmed.
- **Cadastre is NOT required.** A new build sold by a firm (e.g. Xonsaroy) proceeds
  without a cadastre; the pledge attaches to the DDU / share-rights and converts to a
  registered mortgage once the cadastre is issued. Purchase from an individual owner
  does require the cadastre.

## Collateral

- Cash products (OSON, ADM TEAM): collateral is entered separately, exactly as
  credit-core does today, with ≥140% coverage.
- Asset products (AVTO, IPOTEKA): the purchased asset **is** the collateral —
  auto-created from the asset details, no separate pledge entry. Coverage is expressed as
  LTV / down payment rather than a 140% ratio.

## Scoring — one engine, product-aware collateral factor

Reuses `scoreCase` from `@credit-core/shared` unchanged for ~19 of 20 factors (income,
DTI, credit history, age, family, residence, sector, employment, etc.). Only the
**collateral factor** branches by product kind:

- cash → existing pledge-coverage scoring (≥140%).
- asset → LTV / down-payment scoring: full points at or above the product's minimum down
  payment, scaled down below it; plus asset-liquidity considerations (car age for AVTO).

Scoring **does not gate** the workflow (same rule as credit-core): a low score still
advances to director/admin. Excel `балл` fidelity is preserved; the collateral branch is
the only deliberate extension.

## Insurance (per product)

- IPOTEKA: property insurance (the dwelling), mandatory.
- AVTO: car insurance (KASKO), mandatory.
- OSON / ADM TEAM: loan-non-repayment-risk insurance (as in the reference workbook),
  applied per business rule.

Insurance is captured as a document + policy reference; mandatory flags come from the
product config.

## Documents (ideal set per product)

- **OSON / ADM TEAM:** the current credit-core collateral document set.
- **AVTO:** sale/proforma contract · tech passport · vehicle appraisal · KASKO policy ·
  notarial pledge contract.
- **IPOTEKA:** sale contract · cadastre or DDU · property appraisal · property insurance
  policy · notarial mortgage contract.

All generated documents flow through the credit-core document/registry system and are
signable by the director via E-IMZO, as today.

## UI flow

- Clicking **"Yangi ariza"** replaces the sidebar with **four product cards**
  (ADM TEAM · OSON · AVTO KREDIT · IPOTEKA).
- Selecting a product opens that product's wizard. Cash products show the collateral step;
  asset products show the asset + seller + down-payment steps instead of a free pledge.
- Once the term is entered, the wizard header shows the derived
  краткосрочный / долгосрочный label.
- Everything else (scoring modal, document generation, signing, finalize) matches
  credit-core.

## Workflow & roles

Unchanged from credit-core: operator → moderator → director → admin, director signs via
E-IMZO (CLEVER-INN key only), admin finalizes. The product/seller/LTV additions live in
the origination and document layers; the state machine is reused.

## Deploy

- Separate nginx config, `server_name fininvest.uz`, own Let's Encrypt SSL.
- Separate docker stack and MySQL. credit-core's deploy is untouched.

## Out of scope (v1)

- Extracting credit-core's backend NestJS modules (workflow/signing/documents) into
  shared packages — v1 adapts/copies; extraction is a later refactor if it pays off.
- Automated conversion of DDU pledge → registered mortgage on cadastre issuance
  (captured as a manual review step in v1).
- Any change to credit-core itself beyond leaving its two pending commits for the user to
  push.

## Assumptions & open items

- **MKO** (seen beside AVTO in the hand sketch) is treated as a third seller option for
  auto alongside owner and dealer. If it means something else, adjust the seller options.
- Exact rate/term numbers not fixed by the owner use the config defaults above and can be
  edited without code changes.

## Testing approach

- Unit-test each product's parameter profile (rate/term/down-payment bounds, term-band
  derivation) and the product-aware collateral scoring branch, mirroring credit-core's
  scoring spec style.
- Excel-parity tests carry over for the shared 19 factors.
- Seller ownership-mismatch warning is unit-tested (warns, does not block).
- Document render harness per product.
