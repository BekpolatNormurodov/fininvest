# OSON foizlari, forma tozalash va propisyu — dizayn

**Sana:** 2026-07-29
**Doira:** origination formasi (operator), OSON mahsuloti konfiguratsiyasi, sug'urta foizi, summa propisyu.

## Maqsad

Operator formasidan hozircha kerak bo'lmagan maydonlarni vaqtincha olib turish, OSON mahsulotining foiz/muddat/qoplama qiymatlarini egasi belgilagan yangi qiymatlarga keltirish, sug'urta mukofoti chegarasini to'g'rilash va garov qiymatini so'z bilan (propisyu) avtomatik to'ldirish.

## Qat'iy cheklov — Excel

ADM va OSON uchun generatsiya qilinadigan Excel fayllar **bayt darajasida o'zgarmaydi**. Ular ish jarayonida bir-biriga to'g'ri keladi va ularga tegilmaydi. Bu ishdagi o'zgarishlar faqat:

- forma (UI) ko'rinishi,
- mahsulot konfiguratsiyasi (`loan-product.ts`),
- skoring faktorlarining vaqtincha o'chirilishi,
- yangi util (propisyu).

Har bosqichdan keyin `excel-parity`, `schedule-excel` testlari ishlatiladi va yashil bo'lishi shart.

---

## Blok A — Forma va skoring: vaqtincha yashirish

Egasi bu maydonlar hozircha kerak emas dedi. Ular **o'chirilmaydi** — izohga olinadi, qaytarish uchun izoh matni qoldiriladi.

### A1. Shaxsiy maydonlar (bajarilgan)

`packages/ui/src/pages/origination/steps.tsx`, Step1:

- Yashash davomiyligi (`regTenure` / `residenceDuration`)
- Uy egaligi (`ownsHome`)
- Depozit darajasi (`depositsBand`)

### A2. Ish joyi

Xuddi shu faylda, Step2 «Ish joyi» kartasi. Izohga olinadi:

- Ish joyi manzili (`employerAddress`)
- Soha (`sector`, `sectorRiskCode`)
- Lavozim (`position`)
- Ish staji, sana (`workStartDate`)
- Umumiy staj (`experienceBand`)

Qoladi: **«Ish joyi»** (`employer`) — kartaning o'zi va nomi saqlanadi.

### A3. KATM — kredit tarixi

Izohga olinadi:

- To'langan kreditlar soni (`repaidLoansCount`)
- Muddati o'tgan (`overdueSubstandardFlag`)
- Boshqa majburiyatlar (`otherObligations`)
- 5 mln+ kredit (`loansOver5MFlag`)
- MKO/lombard tarixi (`priorMfiPawnshopFlag`)

Qoladi uchtasi: **Aktiv kreditlar soni**, **Jami qarz**, **O'rtacha oylik to'lov**.

### A4. Skoring faktorlari

`packages/shared/src/scoring.ts` — yuqoridagi maydonlarga bog'liq faktorlar vaqtincha izohga olinadi (egasi tasdiqladi). Ta'sir qiladigan faktorlar: `otherObligations` (15), `overdue` (16), `loansOver5M` (17), `priorMfi` (18), `sectorRisk`, `residenceBand`, `ownsHome`, `depositsBand`, `position`, `experienceBand`.

**Oqibat:** jami ball o'zgaradi, shuning uchun `scoring-factors-match-excel.spec.ts` va `scoring.spec.ts` kutilgan qiymatlari mos kelmay qoladi.

**Yechim:** testlar o'chirilmaydi. Ularga vaqtincha holat izohi qo'yiladi va kutilgan qiymatlar joriy (qisqartirilgan) faktor to'plamiga moslanadi. Izohda asl qiymat va qaytarish yo'li yoziladi, toki faktorlar qaytarilganda test ham asliga qaytarilsin.

---

## Blok B — Yangi funksiya

### B1. Summa propisyu (o'zbek kirill)

Yangi util: `packages/shared/src/amount-words.ts`

```
amountInWords(n: number): string
```

- Til: **o'zbek kirill** — masalan `29 000 000` → `йигирма тўққиз миллион сўм`.
- Butun sonlar; tiyin ishlatilmaydi.
- 0 va manfiy son uchun bo'sh satr qaytaradi.

Ulanishi: `packages/ui/src/pages/CaseForm.tsx` — `Kelishilgan garov qiymati` (`agreedValue`) o'zgarganda `Qiymat (прописью)` (`agreedValueWords`) **avtomatik** to'ladi. Maydon **tahrirlanadigan** bo'lib qoladi: operator qo'lda yozgan matn keyingi avto-to'ldirish bilan almashtirilmaydi (faqat bo'sh yoki avval avto-to'ldirilgan qiymat yangilanadi).

### B2. Sana klaviaturada

Tekshirildi: `packages/ui/src/components/forms.tsx` dagi `DatePicker` **allaqachon** klaviaturadan kiritishni qo'llab-quvvatlaydi (`maskDate`, `parseDmy`, Enter/blur bilan tasdiqlash, noto'g'ri sana uchun inline xato).

**Kod o'zgarmaydi.** Serverdagi build eski — faqat qayta deploy qilinadi.

### B3. Passport OCR — chala ma'lumot

Skanerdan `Pasport kim bergan` (`passportIssuer`) va `Berilgan sana` (`passportIssueDate`) chiqmayapti. OCR chiqishi tekshiriladi: agar bu maydonlar umuman o'qilmayotgan bo'lsa, ular «rasmdan o'qildi» belgisiz qoladi va operator qo'lda to'ldiradi — bu holat forma darajasida to'g'ri ishlashi kerak.

---

## Blok C — OSON konfiguratsiyasi

Faqat **OSON**. ADM TEAM, AVTO, IPOTEKA tegilmaydi.

| Nima | Hozir | Bo'ladi |
|---|--:|--:|
| Yillik foiz (ko'rsatiladigan) | 32% | **50%** |
| Jarima foizi | 105% | **200%** |
| Liniya muddati (maks.) | 24 oy | **60 oy** |
| Garov qoplami | ×140% | **×125%** |

### C1. Mahsulot profiliga ikki yangi maydon

`packages/shared/src/loan-product.ts`, `LoanProductProfile`:

- `penaltyRatePct: number` — jarima foizi, foizda. ADM_TEAM / AVTO / IPOTEKA: `105`. OSON: `200`.
- `coverageTarget: number` — naqd mahsulotda garov qoplami koeffitsienti. ADM_TEAM: `1.4`. OSON: `1.25`. Aktiv mahsulotlar (AVTO, IPOTEKA) LTV qoidasidan foydalanadi, bu maydon ular uchun ishlatilmaydi — qiymat `1.4` qoldiriladi.

OSON profilida shuningdek: `rateMinPct: 50`, `maxTermMonths: 60`.

Ikki yordamchi funksiya qo'shiladi:

```
penaltyRateFor(product): number   // fraction, masalan 2.00
coverageTargetFor(product): number
```

### C2. Mavjud konstantalar

`CASH_COVERAGE_TARGET = 1.4` (loan-product.ts) va `COLLATERAL_COVERAGE_TARGET = 1.4` (origination.ts) **saqlanadi** — mahsulot noma'lum bo'lgan joylarda zaxira qiymat sifatida ishlaydi. Mahsulot ma'lum bo'lgan joylar yangi funksiyalarga o'tkaziladi:

- `collateralRequirementMet()` — `coverageTargetFor(product)`
- `packages/ui/src/components/ScorePanel.tsx` — qoplama nisbati va «Qoplama (kerak N%)» yozuvi
- `packages/ui/src/pages/origination/steps.tsx` — «Garov qoplami — mol-mulk ×N%» yorlig'i va hisoblangan qiymat

Yorliqdagi `140%` qattiq yozilgan matn emas, mahsulotdan hisoblanadi.

### C3. Jarima foizi

Hozir uch joyda `?? 1.05` qattiq yozilgan:

- `steps.tsx:237` — `creditLine` patch
- `steps.tsx:288` — ko'rsatiladigan qiymat
- `apps/backend/src/credit-cases/credit-cases.service.ts:125` — saqlash

Uchalasi `penaltyRateFor(product)` ga o'tkaziladi. Mahsulot noma'lum bo'lsa `1.05` zaxira qiymat qoladi.

### C4. Sug'urta mukofoti chegarasi

`packages/shared/src/origination.ts`, `insurancePremiumRate()`:

```
hozir:  m <= 24  → 0.02   |  24 < m <= 48 → 0.04
bo'ladi: m <= 12 → 0.02   |  12 < m       → 0.04
```

Bu **barcha mahsulotlarga** tegishli (mahsulotga bog'liq emas). Funksiya ustidagi izoh yangilanadi.

---

## Ochiq nuqta

`INSURANCE_MAX_MONTHS = 48`. OSON liniyasi 60 oyga uzayganda 60 oylik kreditning oxirgi 12 oyi polissiz qoladi. Bu ishda **o'zgartirilmaydi** — egasi alohida hal qiladi.

## Keyingi bosqich (bu ishga kirmaydi)

D1 varag'idagi daromad formulasi bo'yicha «Daromad va xarajat» hisobini moslashtirish. Buning uchun uchta Excel fayl (hovli, dom, mashina) kerak.

## Tekshirish

Har blokdan keyin:

```
npm run build -w @credit-core/shared
npx jest --runInBand excel-parity schedule-excel scoring
```

Excel parity testlari **yashil** bo'lishi shart. Skoring testlari A4 dagi vaqtincha holatga moslangan bo'ladi.
