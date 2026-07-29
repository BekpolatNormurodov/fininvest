# API Integratsiya Yoriqnomasi — Jismoniy shaxs + firma skoring, Kadastr

> Ichki texnik hujjat. Manba: iHamkor (Soliq) + e-gov servislari.
> Fokus: (1) firma-moliyaviy paketning **5 servisi** chuqur, (2) shaxs+firma → **birlashgan qaror**, (3) **ikki xil kadastr** ajratilgan holda.

---

## 0. Umumiy qoidalar (barcha chaqiruvlar uchun)

| Narsa | Qiymat |
|---|---|
| Kirish kaliti | Jismoniy: **PINFL** (+ ba'zida pasport seriya/raqam). Yuridik: **INN** |
| Til | `Язык` — javob tili (uz-lat / uz-cyr / ru) |
| Auth | Provider tokeni (Egov gateway), har so'rovда header |
| Rozilik (PDP) | Har chaqiruvdan oldin qarz oluvchidan **rozilik** olingan bo'lishi shart; consent_id logga yoziladi |
| Kesh (TTL) | Kam o'zgaruvchi: pasport/kadastr — 24 soat; moliyaviy — 6 soat; stop-faktor — **keshsiz** (har safar tirik) |
| Xato | Timeout/5xx → retry (2x, backoff); ma'lumot yo'q → `null` (rad emas, «tekshirilmadi» statusi) |

---

## 1. Orkestratsiya — chaqiruv ketma-ketligi

```
Stage 1  KYC            GcpDocRest → MVDAddressInfoService → (AdliyaMarriage)
Stage 2  Daromad        iHamkor_Fizsalary + MehnatCurrentPosition
Stage 2b FIRMA KO'PRIK  iHamkor_Founder + iHamkor_Director   →  firma INN(lar) ro'yxati
Stage 3  FIRMA MOLIYA   [har firma INN uchun] Buxbalans, Finreport, Nds/Выручка, Yurdebt, DXABusinessReg
Stage 4  STOP-FAKTOR    MIBDebtorexec, MIBDebtban, MibFizInsolvent, iHamkor_Fizdebt, MIBAliment
Stage 5  GAROV KADASTR  Kadastr + MVDRegistrationKadastr + MIBRealty   (yoki AVTO: YHXBB + MIBAuto)
         XULOSA         skoring formulasi → PASS / MANUAL / REJECT
```

Muhim: **Stage 4 (stop-faktor) hard-gate** — istalgan biri ijobiy chiqsa, moliyaviy hisob-kitobga bormasdan MANUAL/REJECT.

---

## 2. Firma-moliyaviy paket — 5 servis (chuqur)

Har biri **INN** bilan chaqiriladi (ko'prikdan olingan firma INN'i).

### 2.0 Ko'prik: `iHamkor_Founder` (#10) va `iHamkor_Director` (#13)
- **Kirish:** PINFL (jismoniy shaxs)
- **Chiqish (muhim maydonlar):** har firma uchun `ИНН`, `Полное/Краткое наименование`, `Дата регистрации`, `Состояние/статус` + `Дата прекращения деятельности`, `ОПФ`, `Размер уставного фонда`, `Доля учредителя (в % и в сумах)` *(Founder'da)*, `ОКЭД` (faoliyat turi), `Регион/Район`, `Регистрационный код плательщика НДС`.
- **O'qish:** firmalar ro'yxatidan **asosiy firmani** tanla — mezon: `Состояние = faol` **VA** (eng katta `Доля` **YOKI** Director roli). Likvidatsiya sanasi bo'lsa — o'sha firma tashlab yuboriladi.

### 2.1 `iHamkor_Buxbalans` (Buxgalteriya balansi, 1-shakl) — #16/17/18
- **Kirish:** `ИНН`, `Год`, `Период (квартал)`, `Язык`
- **Chiqish:** massив — `Код строки`, `На начало отчётного периода`, `На конец отчётного периода` (тыс.сум)
- **O'qish (O'zbekiston 1-shakl kod qatorlari bo'yicha):**
  - **Aktivlar jami** (balans valyutasi) — kompaniya hajmi
  - **O'z kapitali** (ustav fondi + taqsimlanmagan foyda) — moliyaviy mustahkamlik
  - **Majburiyatlar** (uzoq + qisqa muddat) — qarz yuki
  - → **Leverage = Majburiyatlar / O'z kapitali** (yuqori bo'lsa risk)

### 2.2 `iHamkor_Finreport` (Moliyaviy natijalar, 2-shakl) — #19/20/21
- **Kirish:** `ИНН`, `Год`, `Период (квартал)`, `Язык`
- **Chiqish:** `Код строки`, o'tgan davr `Доходы/Расходы`, joriy davr `Доходы/Расходы`
- **O'qish:** `Sof tushum` (чистая выручка) va **`Sof foyda/zarar`** (прибыль/убыток до налога). **Zarar (убыток) = katta risk-signal.** Foyda dinamikasi (o'tgan → joriy) — o'sish/pasayish.

### 2.3 `iHamkor_Nds` / `iHamkor_InvoiceKkmByMonth` (QQS bazasi / Выручка) — #24 / #40
- **Kirish:** `ИНН`, `Год` (+ Nds V3 oylik beradi)
- **Chiqish:** `Обороты по реализации` va `Чистая выручка` (oylik/choraklik)
- **O'qish:** **haqiqiy aylanma dinamikasi** — bu firmaning tirik pul oqimi. Hisobot foydasidan ko'ra ishonchliroq (KKM/hisob-faktura asosida). Oylik trend → mavsumiylik, o'sish.

### 2.4 `iHamkor_Yurdebt` (Yuridik shaxs soliq qarzi) — #28
- **Kirish:** `ИНН`, `Язык`
- **Chiqish:** `Код налога`, `Сумма задолженности`, `Сумма пени`, `Дата возникновения`, `Переплата`
- **O'qish:** **Soliq qarzi bor firma = risk.** Qarz / oylik aylanma nisbati katta bo'lsa — MANUAL. Пеня o'sib borayotgan bo'lsa — moliyaviy qiyinchilik belgisi.

### 2.5 `DXABusinessReg` (Ro'yxatdan o'tish guvohnomasi) — e-gov #9
- **Kirish:** `ИНН`
- **Chiqish:** davlat ro'yxatidan o'tganlik guvohnomasi ma'lumotlari (raqam, sana, status)
- **O'qish:** firma **huquqiy jihatdan mavjud va faol** ekanini tasdiqlaydi. (+ ixtiyoriy: `DXALincense` — litsenziyali faoliyat bo'lsa.)
- **Bonus:** `iHamkor_CompanyRatingInfo` (#40 barqarorlik reytingi) — tayyor **0–100 ball** beradi; agar mavjud bo'lsa, uni to'g'ridan-to'g'ri firma-skoriga ulash mumkin.

---

## 3. Birlashgan xulosa — shaxs X + firma Y (ishlangan misol)

**Kirish:** qarz oluvchi X, so'ralgan kredit oylik to'lov = **5 mln so'm**.

| Bosqich | Manba | Natija (misol) |
|---|---|---|
| KYC | GcpDocRest, MVDAddress | Pasport amal qiladi, manzil mos ✅ |
| Rasmiy oylik | iHamkor_Fizsalary | 3 mln so'm/oy (12 oy o'rtacha) |
| Firma topildi | iHamkor_Director | «Y» MChJ, INN, **Director**, faol, ro'yxat 2019 |
| Firma balansi | Buxbalans | Aktiv 1.2 mlrd, kapital 400 mln, leverage 2.0 (o'rta) |
| Firma foydasi | Finreport | Sof foyda 240 mln/yil ✅ (o'tgan yil 180 mln — o'sish) |
| Firma aylanmasi | Nds/Выручка | 2.4 mlrd/yil, barqaror oylik trend ✅ |
| Firma soliq qarzi | Yurdebt | Qarz yo'q ✅ |
| Stop-faktor | MIB×3 | Toza ✅ |

**Daromad quvvatini hisoblash:**
```
Shaxsiy oylik           = 3 000 000
Firma egasidan daromad  = (yillik sof foyda × egalik ulushi) / 12 × haircut(0.5)
                        = (240 000 000 × 100% ) / 12 × 0.5  = 10 000 000
Samarali oylik daromad  = 3 000 000 + 10 000 000           = 13 000 000
```
> **Haircut (0.5)** — firma foydasi to'liq shaxsga o'tmaydi (reinvestitsiya, boshqa ta'sischilar, mavsumiylik). Ehtiyot koeffitsiyenti. Director-only (ulushsiz) bo'lsa yanada past haircut (0.3) yoki faqat lavozim daromadi.

**DTI (qarz yuki):**
```
Mavjud majburiyat (aliment + KATM bo'yicha joriy kreditlar) = 2 000 000
Yangi to'lov                                                = 5 000 000
DTI = (2 000 000 + 5 000 000) / 13 000 000 = 54%   →  siyosat chegarasi ≤ 50% bo'lsa → MANUAL
```

**Qaror qoidalari:**
| Shart | Natija |
|---|---|
| Istalgan stop-faktor ijobiy (MIB/insolvent) | **REJECT** |
| Firma likvidatsiya / zarar (убыток) / katta soliq qarzi | firma daromadini **hisobga olmaslik**, faqat shaxsiy oylik |
| DTI ≤ 50% va toza | **PASS** |
| DTI 50–65% yoki chegara holat | **MANUAL** (moderator/direktor) |
| DTI > 65% | **REJECT** |

---

## 4. Ikki xil kadastr — ajratilgan (juda muhim)

Bular **butunlay boshqa maqsad** va **boshqa kirish kaliti**. Aralashtirmaslik kerak.

### 4a. Shaxsning o'z mol-mulki — DISCOVERY (kirish = PINFL)
- **Servis:** `iHamkor_Fiztaxobjects` (#3) — Jismoniy shaxsning mulki
- **Kirish:** `PINFL`, `ИНН`, `Язык`
- **Chiqish:**
  - *Ko'chmas mulk:* `Код объекта (кадастровый номер)`, `Наименование/Адрес объекта`, `Доля в имуществе`, `Инвентаризационная стоимость`, `Общая площадь`
  - *Avto:* `Модель`, `Цвет`, `Год выпуска`, `Тип`, `Номер кузова/двигателя/шасси`, `Гос. рег. номер`, `Дата регистрации`
- **Maqsad:** qarz oluvchining **umumiy boyligi / moliyaviy holati** (net worth) — skoring uchun. Bu **garov tekshiruvi EMAS.**
- **Natija:** shaxs qanaqa mulklarga ega — va ularning **kadastr raqamlari** (buni 4b'ga uzatish mumkin).

### 4b. Garov kadastri — VERIFY (kirish = kadastr raqami)
Aniq bir ob'ekt (ipoteka/garovga qo'yilayotgan) tekshiriladi:
- `Kadastr` (#118) — **Kirish:** kadastr raqami → ob'ekt tafsiloti, maydon, tur, egasi
- `MVDRegistrationKadastr` (#74) — **Kirish:** kadastr raqami → shu manzilда **propiskadagilar** (voyaga yetmagan bolalar ipotekani bloklaydi!)
- `MIBRealty` (#47) — **Kirish:** PINFL/ob'ekt → mulkка **taqiq/hibs** bormi
- **Maqsad:** garov **toza, egasi to'g'ri, band emas** ekanini tasdiqlash.

### Zanjir (discovery → verify)
```
Fiztaxobjects (PINFL)  →  shaxs mulklari + kadastr raqamlari
      │  (agar shaxs o'z mulkini garovga qo'ysa)
      ▼
Kadastr + MVDRegistrationKadastr + MIBRealty (kadastr raqami)  →  garov tozaligi
```
Agar garov **uchinchi shaxs** mulki bo'lsa — 4a o'tkazib yuboriladi, to'g'ridan-to'g'ri 4b (garov egasining kadastri) ishlaydi.

> AVTO uchun ekvivalent: DISCOVERY = `YHXBBCarList` (PINFL → egalikdagi avtolar), VERIFY = `YHXBBVehicleInfo` (davlat raqami/tex passport) + `MIBAuto` (taqiq).

---

## 5. Yakuniy skoring formulasi (jamlangan)

```
IF stop_factor(MIB_debtorexec | MIB_debtban | insolvent) → REJECT
income_personal   = avg12(Fizsalary)
income_firm       = Σ over firms:  (firm_ok ? net_profit × share × haircut / 12 : 0)
                    firm_ok = faol AND foyda>0 AND soliq_qarzi kichik
income_effective  = income_personal + income_firm
obligations       = aliment + KATM_joriy_toʻlovlar
DTI               = (obligations + yangi_toʻlov) / income_effective
collateral_ok     = (AVTO: YHXBB toza & MIBAuto yo'q) OR (IPOTEKA: Kadastr toza & propiskada voyaga yetmagan yo'q & MIBRealty yo'q)
DECISION          = (DTI ≤ 50% AND collateral_ok) ? PASS
                  : (DTI ≤ 65%) ? MANUAL : REJECT
```

---

## 6. Ilova — servis → endpoint jadvali (P0 + firma)

| Servis | Kirish | Fayl/№ |
|---|---|---|
| GcpDocRest | pasport/PINFL | e-gov 17 |
| MVDAddressInfoService | PINFL | e-gov 72 |
| iHamkor_Fizsalaryv2 | PINFL | Defen 2 |
| MehnatCitizenCurrentPosition | PINFL | e-gov 35 |
| **iHamkor_Founder** | PINFL | Defen 10 |
| **iHamkor_Director** | PINFL | Defen 13 |
| **iHamkor_Buxbalans** | INN | Defen 16-18 |
| **iHamkor_Finreport** | INN | Defen 19-21 |
| **iHamkor_Nds / Выручка** | INN | Defen 24 / 40 |
| **iHamkor_Yurdebt** | INN | Defen 28 |
| **DXABusinessReg** | INN | e-gov 9 |
| iHamkor_CompanyRatingInfo | INN | Defen 40 (reyting) |
| iHamkor_Fizdebt | PINFL | Defen 6 |
| iHamkor_Fiztaxobjects | PINFL | Defen 3 |
| MIBDebtorexec / Debtban / FizInsolvent / Aliment | PINFL | e-gov 45/44/48/39 |
| Kadastr / MVDRegistrationKadastr / MIBRealty | kadastr № | e-gov 118/74/47 |
| YHXBBVehicleInfo / CarList / MIBAuto | tex-pas / PINFL | e-gov 101/99/41 |
