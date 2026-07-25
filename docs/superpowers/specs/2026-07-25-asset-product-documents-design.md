# Aktiv (AVTO / IPOTEKA) hujjatlarini mahsulotga moslash — Design

**Sana:** 2026-07-25
**Loyiha:** fin-invest — hujjat generatsiyasini asset-purchase mahsulotlariga (AVTO, IPOTEKA) to'g'ri moslash.

## Maqsad (Goal)

Tizim o'zi generatsiya qiladigan hujjatlar AVTO/IPOTEKA uchun mahsulotga **to'g'ri** bo'lsin: shartnoma aktivni «sug'urtalanmaydi» deb yozmasin, sug'urta mahsulot turiga (KASKO / mulk) qarab aks etsin, filing-cheklist aktiv hujjatlarini ro'yxatlasin, registry aktiv case'ga faqat mos hujjatlarni bersin.

## Eng muhim guardrail (invariant)

**ADM_TEAM va OSON (naqd, `LoanProductKind.CASH`) hamda mahsulotsiz (legacy) case'lar uchun generatsiya qilinadigan hujjatlar bayt-bayt O'ZGARMAYDI.** Bu hujjatlar MKO Excel workbook'iga sodiq (excel-fidelity) va shunday qolishi shart.

- Har bir o'zgarish **faqat** `isAsset = c.product ? loanProductProfile(c.product).kind === LoanProductKind.ASSET : false` bo'lganda kuchga kiradi.
- `isAsset === false` (naqd yoki legacy) yo'li hozirgi kod bilan **aynan bir xil** ishlaydi.
- Mavjud excel-parity / render testlari (`__render__/excel-parity.spec.ts`, `render-db.spec.ts`, `schedule-excel.spec.ts`, `act.spec.ts`, `cheklist.spec.ts`) **yashil qolishi** — CI gate.

## Ikki «product» tushunchasi (kontekst)

- `ProductType` = `AUTO | REAL_ESTATE` — garov turi (collateral). Ko'p shablonlar shunga qarab shoxlanadi.
- `LoanProduct` = `ADM_TEAM | OSON | AVTO | IPOTEKA` — haqiqiy mahsulot (`c.product`, nullable).
- Bu ishda yangi shoxlar **`LoanProduct` (aniqrog'i `isAsset`)** ga tayanadi; mavjud collateral-type shoxlariga tegilmaydi (ular naqd uchun ham kerak).

## O'zgarishlar (Components)

### 1. Shartnoma sug'urta bandi — `templates/_collateral.ts`, `templates/contract.ts`
- Hozir: `contractCollateralProse` har garov xatboshisiga «Гаров объекти сугурталанмайди» ni **qat'iy** yozadi (`_collateral.ts:307`), 3.1.2 default ham shu (`contract.ts:155`).
- Yangi: **faqat `isAsset`** bo'lsa, bu ibora o'rniga mahsulotga xos sug'urta jumlasi:
  - AVTO → aktiv **KASKO** bo'yicha sug'urtalanadi.
  - IPOTEKA → aktiv **mol-mulk sug'urtasi** bo'yicha sug'urtalanadi.
- Naqd yo'li: o'zgarmaydi (hozirgi «сугурталанмайди» yoki mavjud `insurance.insured` mantiqi).
- **Yuridik matn:** to'liq band o'zim yozmayman. Qisqa, faktik ibora qo'yaman va `// TODO(legal): yakuniy so'zlashuvni tasdiqlang` bilan belgilayman. Matn `loanProductProfile(product).insurance` ga qarab tanlanadi, bitta joyda (helper).

### 2. Sug'urta qatori — `templates/credit-application.ts`, `templates/petition.ts`
- Hozir: LOAN_RISK «кредит қайтмаслик хавфи полиси» qatori `isAutoOnly` bo'lsa **yashiriladi** → sof AVTO da umuman sug'urta ko'rinmaydi.
- Yangi: ko'rsatish qaroriga **mahsulot sug'urta turi** kiradi:
  - `isAsset && insurance === CAR` → KASKO qatori.
  - `isAsset && insurance === PROPERTY` → mulk sug'urta qatori.
  - naqd (`LOAN_RISK`) → **hozirgi mantiq aynan** (auto-only bo'lsa yashirin, aks holda ko'rinadi).
- Ibora qisqa/faktik; `// TODO(legal)` bilan.

### 3. Filing cheklist / перечень — `templates/cheklist.ts`
- Hozir: 16 qatorli **statik** ro'yxat, naqd-garov modeli («Гаров Шартномаси» va h.k.), `_c` ishlatilmaydi.
- Yangi: `isAsset` bo'lsa qatorlar mahsulotga moslanadi (naqd uchun **hozirgi statik ro'yxat aynan qoladi**):
  - Umumiy (aktivda ham): ariza, pasport, KATM, shartnoma, jadval.
  - Aktiv qo'shimchalari (`productExtraDocs(product)` bilan izchil): **oldi-sotdi shartnomasi**, **tex passport (AVTO) / kadastr (IPOTEKA)**, **appraisal (baholash akti)**, **KASKO (AVTO) / mulk sug'urta polisi (IPOTEKA)**, **boshlang'ich to'lov kvitansiyasi**.
  - Aktivda o'rinsiz naqd-garov qatorlari (masalan alohida «Гаров Шартномаси») chiqmaydi.

### 4. Registry mahsulot-filtri — `documents/registry.ts` (va `case-documents.controller.ts` ro'yxati)
- Hozir: `DOC_REGISTRY` statik — har case'ga bir xil to'plam.
- Yangi: yengil **filtr** — `isAsset` bo'lsa sof-garov baholash hujjatlari (masalan «Акт согласования» garov-qiymati) ro'yxatdan chiqariladi yoki mos nomlanadi. Naqd yo'li: to'liq to'plam, o'zgarmaydi.
- Yondashuv: registryga har doc uchun ixtiyoriy `appliesTo?: 'cash' | 'asset' | 'both'` (default `'both'`) belgisi; controller ro'yxatni `c.product` ga qarab filtrlaydi. Naqd/legacy → hammasi `'both'`/`'cash'` → hozirgidek.

## Ma'lumot oqimi (Data flow)
- Kirish: `c.product` (LoanProduct|null), `loanProductProfile(product).insurance` (InsuranceKind), collateral `type`, `productExtraDocs(product)`.
- Yangi umumiy helper: `assetInsuranceLabel(product)` → `{ uz, ru }` (KASKO / mulk sug'urtasi / null) — bitta joyda, shablonlar shundan oladi. `packages/shared/src/product-documents.ts` yoniga yoki `loan-product.ts` ga.

## Xatoliklar / chekka holatlar
- `c.product == null` (legacy) → `isAsset=false` → hamma yangi shox o'chiq, naqd yo'li.
- Aktiv, lekin `insurance` kutilmagan qiymat → xavfsiz default (qator chiqmaydi), crash yo'q.
- Cheklist aktiv qatorlari faqat qo'shiladi; statik naqd ro'yxati alohida saqlanadi.

## Test
- **Yangi (asset):**
  - Aktiv (AVTO/IPOTEKA) shartnoma render'i «сугурталанмайди» iborasini **o'z ichiga olmaydi**; KASKO/mulk iborasini **o'z ichiga oladi**.
  - Sof AVTO application/petition render'i sug'urta qatorini **ko'rsatadi** (KASKO).
  - Cheklist(AVTO) «oldi-sotdi» va «KASKO» qatorlarini, Cheklist(IPOTEKA) «kadastr» va «mulk sug'urta» qatorlarini o'z ichiga oladi.
  - Registry(AVTO) sof-garov baholash hujjatini chiqarmaydi.
- **Regressiya (cash — MUST stay green):** mavjud `excel-parity`, `render-db`, `act.spec`, `cheklist.spec`, `schedule-excel` — o'zgarmaydi. Kerak bo'lsa ADM/OSON uchun snapshot-lock qo'shiladi.

## Qamrovdan tashqari (Out of scope)
- Tashqi hujjatlarni (oldi-sotdi shartnomasi, KASKO/mulk polisi, appraisal) **generatsiya qilish** — bular operator uploadlari bo'lib qoladi.
- Skoring dvigatelini mahsulotga moslash (alohida bo'lak C).
- Origination UI/UX sayqal (alohida bo'lak B).
- ADM/OSON hujjatlariga har qanday o'zgarish.

## Ochiq savol (implementatsiyada tasdiqlanadi)
- Sug'urta band/qatorining **aniq yuridik so'zlashuvi** — men minimal faktik matn qo'yaman, `// TODO(legal)` bilan; foydalanuvchi yakunlaydi.
