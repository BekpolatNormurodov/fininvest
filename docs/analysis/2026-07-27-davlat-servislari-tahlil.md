# Tashqi davlat servislari — FinInvest uchun tahlil

> Manba: **Список сервисов (Defen).xlsx** (Soliq qo'mitasi / iHamkor — 44 servis + 11 ma'lumotnoma) va **Список сервисов (2).xlsx** (umumiy e-gov — 119 servis, 25+ idora).
> Maqsad: kredit jarayoni (ADM TEAM / OSON / Avto / Ipoteka) uchun **qaysi servislar kerak** — tartiblab, muhimlik bo'yicha.

---

## 1. Ikki fayl nima?

| Fayl | Kim beradi | Nechta | Mazmuni |
|---|---|---|---|
| **Defen** | Soliq qo'miti (Egov orqali «iHamkor») | 44 + 11 ref | Daromad, ish haqi, mol-mulk, soliq qarzi, o'zini band, YaTT, yuridik shaxs moliyaviy hisobotlari, QQS, hisob-fakturalar |
| **(2)** | Ko'p idora (Adliya, IIV, MIB, Kadastr, YHXBB, Bojxona, Mehnat, MinFin, Sug'urta fondi…) | 119 | Pasport, propiska, FHDYo (nikoh/vafot), ijro (MIB), avto, kadastr, pensiya, litsenziya va h.k. |

Ikkalasi bir-birini **to'ldiradi** (dublikat emas): Soliq daromad/mol-mulkni beradi, e-gov identifikatsiya + garov + risk tekshiruvlarini beradi.

⚠️ **KATM (kredit tarixi) bu ikkala ro'yxatda YO'Q** — u alohida manba, sizda allaqachon bor. Bu servislar KATM'ni almashtirmaydi, uni **to'ldiradi**.

---

## 2. Funksional bloklar (kredit oqimi bo'yicha)

Kredit qarori 6 blokdan iborat. Har bir servis shu bloklardan biriga tegishli.

### Blok 1 — Shaxsni tasdiqlash (KYC) · **P0**
| Servis | Fayl | Nima beradi |
|---|---|---|
| **GcpDocRest** (pasport ma'lumotlari) | (2) #17 | Pasport haqiqiyligi, F.I.O, PINFL — *asos* |
| **MVDAddressInfoService** (propiska) | (2) #72 | Ro'yxatdan o'tish manzili (PINFL bo'yicha) |
| **AdliyaMarriage / AdliyaDivorce** | (2) #4/#3 | Nikoh holati → er-xotin roziligi (ipoteka/garovda muhim) |
| AdliyaDeath | (2) #2 | Vafot tekshiruvi (firibgarlik/hammuallif) — P1 |

### Blok 2 — Daromad / to'lov qobiliyati · **P0** (skoringning yuragi)
| Servis | Fayl | Nima beradi |
|---|---|---|
| **iHamkor_Fizsalaryv2** (ish haqi) | Defen #2 | Rasmiy ish haqi, INPS, soliq — *DTI uchun asosiy* |
| **MehnatCitizenCurrentPosition** | (2) #35 | Joriy ish joyi, lavozim, ish beruvchi |
| MehnatCitizenHistory | (2) #36 | Ish staji / barqarorlik — P1 |
| iHamkor_SelfEmployment / _Individual | Defen #7/#8 | O'zini band / YaTT daromadi — P1 |
| iHamkor Fiz выручка (invoice) | Defen #11 | Tadbirkor tushumi — P1 |
| iHamkor_Fizdividend / _Rents | Defen #5/#4 | Dividend / ijara daromadi — P1 |
| **MinFinMainPension** / IHMAPensionerIncome | (2) #52/#104 | Pensiya daromadi (pensioner qarz oluvchilar) — P1 |

### Blok 2b — Qarz oluvchining firmalari (biznes-egasi ko'prigi) · **P0/P1**
Jismoniy shaxs bo'lsa ham, uning tadbirkorlik faoliyatini aniqlaymiz — rasmiy ish haqidan tashqari **real daromad quvvati**.
| Servis | Fayl | Nima beradi |
|---|---|---|
| **iHamkor_Founder** | Defen #10 | Shaxs **ta'sischisi** bo'lgan yuridik shaxs(lar) — firma INN bilan |
| **iHamkor_Director** | Defen #13 | Shaxs **rahbari** bo'lgan yuridik shaxs(lar) — firma INN bilan |

**Ko'prik zanjiri:** `PINFL → Founder/Director → firma INN → firma moliyaviy paketi (Blok 7)`.
Shu tariqa biznes egasining haqiqiy aylanmasi/foydasi skoringга kiradi. **Blok 7 aynan shu topilma bo'yicha ishga tushadi** — alohida «yuridik shaxs mahsuloti» kerak emas.

### Blok 3 — Mavjud majburiyat / qarz (DTI) · **P0**
| Servis | Fayl | Nima beradi |
|---|---|---|
| **iHamkor_Fizdebt** (soliq qarzi) | Defen #6 | Jismoniy shaxs soliq qarzdorligi |
| **MIBAliment** (aliment) | (2) #39 | Aliment majburiyati → oylik yukka qo'shiladi |
| iHamkor_Fiztaxobjects | Defen #3 | Shaxs mol-mulki (avto+ko'chmas) — aktivlarni ko'rish |

### Blok 4 — Salbiy / stop-faktorlar (risk) · **P0**
| Servis | Fayl | Nima beradi |
|---|---|---|
| **MIBDebtorexec** (ijro varaqasi — qarzdor) | (2) #45 | Qarzdorda ijro varaqasi bormi — *kuchli stop-signal* |
| **MIBDebtban** (chiqish taqiqi) | (2) #44 | Chet elga chiqish taqiqi → default belgisi |
| **MibFizInsolvent** | (2) #48 | Insofsiz / to'lovga qobiliyatsizlar ro'yxati |
| MIBExecAction | (2) #46 | Ijro jarayoni holati — qo'llab-quvvat |
| MVDConvictionCheck (sudlanganlik) | (2) #73 | Jinoiy o'tmish — siyosatga qarab P1 |
| MinzdravNarko/PsychoDisp | (2) #69/#70 | Narko/ruhiy dispanser → muomala layoqati (imzo/notarius) — P1 |

### Blok 5 — Garov: AVTO · **P0 (faqat Avto kredit)**
| Servis | Fayl | Nima beradi |
|---|---|---|
| **YHXBBVehicleInfo / VehicleLicense** | (2) #101/#102 | Avto + tex passport ma'lumoti (asosiy) |
| **YHXBBCarList** | (2) #99 | PINFL/INN bo'yicha egalikdagi avtolar |
| **MandatoryInsuranceService** | (2) #33 | OSAGO / majburiy sug'urta mavjudligi |
| **MIBAuto / MIBAutomobile** | (2) #41/#42 | Avtoga taqiq / ijro varaqasi (garov tozaligi) |
| GTKImportedVehicles / GTKTransport | (2) #29/#30 | Bojxona rasmiylashtiruvi (import avto proveniyensi) — P1 |
| YHXBBDriverLicense | (2) #100 | Haydovchilik guvohnomasi — P2 |

### Blok 6 — Garov: KO'CHMAS MULK · **P0 (Ipoteka + real-estate garov)**
| Servis | Fayl | Nima beradi |
|---|---|---|
| **Kadastr** | (2) #118 | Kadastr ma'lumotlari (asosiy) |
| **MVDRegistrationKadastr** | (2) #74 | Kadastr bo'yicha propiskadagilar (voyaga yetmaganlar ipotekani bloklaydi) |
| **MIBRealty** (estateban) | (2) #47 | Ko'chmas mulkka taqiq/hibs |
| Kommunal balans (Hududgaz/RES/Suvsoz/MyHouse) | (2) #31,#81,#87,#76 | Mulk faolligi / manzil tasdig'i — P2 |

### Blok 7 — Firma moliyaviy paketi (biznes-egasi ko'prigi orqali) · **shartli, P1**
Blok 2b qarz oluvchining firmasini topgach (`Founder`/`Director` → firma INN), o'sha firmaning quvvatini baholaymiz:
- **Moliyaviy:** iHamkor_Yurnp1 (#15), Buxbalans (#16-18), Finreport (#19-21), ЕНП (#22-23), QQS (#24-26), yur выручка (#40), barqarorlik reytingi (#44).
- **Majburiyat/risk:** yur soliq qarzi (#28), MibYurInsolvent (e-gov #49).
- **Ro'yxatdan o'tish:** DXABusinessReg (e-gov #9), StatYagonaRegistr (e-gov #86).

Bu **alohida mahsulot emas** — jismoniy shaxs arizasining ichida, firma topilganda avtomatik ishga tushadigan chuqurlashtirilgan skoring. Firma topilmasa — bu blok o'tkazib yuboriladi.

> 📄 Bu 5 servisning chuqur tahlili, birlashgan qaror mantig'i, ishlangan misol va texnik API orkestratsiyasi — alohida hujjatda: **[api-integratsiya-yoriqnoma.md](2026-07-27-api-integratsiya-yoriqnoma.md)**. Shu yerda **ikki xil kadastr** (garov kadastri ≠ shaxsning o'z mol-mulki) ham ajratilgan.

---

## 3. Mahsulot × Blok matritsasi

| Blok | ADM TEAM | OSON | AVTO | IPOTEKA |
|---|:--:|:--:|:--:|:--:|
| 1 KYC | ✅ | ✅ | ✅ | ✅ |
| 2 Daromad | ✅ | ✅ | ✅ | ✅ |
| 3 Majburiyat/DTI | ✅ | ✅ | ✅ | ✅ |
| 4 Stop-faktor | ✅ | ✅ | ✅ | ✅ |
| 5 Garov — Avto | — | — | ✅ | — |
| 6 Garov — Ko'chmas | garov bo'lsa | garov bo'lsa | — | ✅ |

ADM/OSON — naqd (pledge garov ixtiyoriy); AVTO/IPOTEKA — aktiv sotib olinadi, garov shu aktiv.

---

## 4. Yakuniy tavsiya — bosqichma-bosqich ulanish

### 🟢 P0 — MVP (har bir arizada, ~10 umumiy + mahsulot garovi)
Umumiy: `GcpDocRest`, `MVDAddressInfoService`, `iHamkor_Fizsalaryv2`, `MehnatCitizenCurrentPosition`, `iHamkor_Founder`, `iHamkor_Director`, `iHamkor_Fizdebt`, `iHamkor_Fiztaxobjects`, `MIBDebtorexec`, `MIBDebtban`, `MibFizInsolvent`, `MIBAliment`.
+ AVTO: `YHXBBVehicleInfo`, `YHXBBCarList`, `MandatoryInsuranceService`, `MIBAuto`.
+ IPOTEKA/garov: `Kadastr`, `MVDRegistrationKadastr`, `MIBRealty`, `AdliyaMarriage`.

**Jami P0 ≈ 15–18 servis.**

### 🟡 P1 — kengaytirilgan skoring (keyingi bosqich)
`MehnatCitizenHistory`, `iHamkor_SelfEmployment`, `iHamkor_Individual`, `iHamkor_Fizdividend`, `iHamkor_Rents`, `MinFinMainPension`/`IHMAPensionerIncome`, `MVDConvictionCheck`, `MinzdravNarko/PsychoDisp`, `GTKImportedVehicles`, `AdliyaDeath`, `MIBExecAction`.

### 🔵 P2 — opsional / kelajak
Kommunal balanslar (manzil-liveness), `ArxivCreateRequest` (staj), `YHXBBDriverLicense`, ijtimoiy daftarlar (`TemirDaftar` va h.k. — nozik).

### ⚪️ Kerak emas (kredit uchun ahamiyatsiz — chiqarib tashlash)
Ta'lim (DTM/diplom/talaba/maktab/litsey), sport razryadlari, bojxona posilka, e-auksion, davlat aktivlari, UzStandart/UzPharm sertifikatlari, emlash/vaqtinchalik nogironlik, ekologiya (chiqindi), bog'cha/kontrakt to'lovlari — jami ~60+ servis.

---

## 5. Muhim eslatmalar (tashqi provayder bilan shartnomaga)

1. **Ma'lumotnomalar (справочники):** Defen'dagi 11 ta ref (viloyat/tuman kodlari, soliq nomlari, faoliyat turlari) — bir marta yuklab, kod→nom dekodlash uchun. Ular «servis» emas, infratuzilma.
2. **Dublikatlar:** mol-mulk 3 joyda keladi — Defen #3 (tez ro'yxat), Kadastr #118 + YHXBB #101 (rasmiy batafsil). Skoring uchun Defen #3, hujjat/garov rasmiylashtirish uchun Kadastr/YHXBB.
3. **Daromad ikki manba:** Soliq `Fizsalary` (miqdor, soliq ushlangan) + Mehnat `CurrentPosition` (ish beruvchi, lavozim). Ikkalasi birga — to'liq tasvir.
4. **Huquqiy (PDP):** har bir chaqiruv shaxsiy ma'lumot — qarz oluvchidan **rozilik** (ariza bosqichida) shart. MIB/sudlanganlik/dispanser kabi nozik bloklar uchun alohida asos kerak.
5. **Scope hal qilindi:** kredit **jismoniy shaxsga** beriladi, lekin `Founder`/`Director` ko'prigi orqali qarz oluvchining firmalari aniqlanadi va firma moliyaviy paketi (Blok 7) skoringni chuqurlashtiradi. Alohida yuridik shaxs mahsuloti kerak emas — Blok 7 firma topilganda avtomatik ishga tushadi.
