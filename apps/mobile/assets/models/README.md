# `assets/models/` — yuzni tanish modeli

## Holat: PLACEHOLDER (real model EMAS)

`mobilefacenet.tflite` hozircha bir necha baytli matnli fayl — u haqiqiy
TensorFlow Lite modeli **EMAS**. U faqat quyidagilarni **yashil** saqlash uchun
mavjud:

- `flutter pub get` / `flutter analyze` (asset deklaratsiyasi `pubspec.yaml`da
  mavjud bo'lishi kerak, muqobil fayl bo'lmasa xato beradi)
- `flutter test` (unit/widget testlar)
- `flutter build ...` (asset bundle qurilishi)

Qurilmada **haqiqiy on-device yuzni tanish inference'i ishlashi uchun**, shu
aniq yo'lga (`assets/models/mobilefacenet.tflite`) haqiqiy MobileFaceNet TFLite
modeli qo'yilishi **SHART**.

## Talablar (real model uchun)

| Xususiyat | Qiymat |
|---|---|
| Format | TensorFlow Lite (`.tflite`) |
| Kirish (input) | `112×112` RGB rasm — `kFaceInputSize` (`lib/core/constants/app_constants.dart`) |
| Chiqish (output) | 128 yoki 192 o'lchamli embedding vektor — `kFaceEmbeddingSize` (default `192`, real modelga qarab moslanadi) |
| Litsenziya | OFL (Open Font License) yoki Apache-2.0 — davlat/tijorat loyihasida erkin foydalanishga ruxsat beruvchi litsenziyalardan biri bo'lishi shart |

Tanlangan modelning haqiqiy chiqish o'lchamiga qarab
`lib/core/constants/app_constants.dart` dagi `kFaceEmbeddingSize`ni
(128 yoki 192) yangilang.

## Nega placeholder bilan ham build/test yashil qoladi

`FaceEmbedder` (Task 12) `load()` ichida modelni yuklash xatosini **ushlamaydi**
(`very_good_analysis` `avoid_catching_errors` sababli `ArgumentError`ni ushlash
mumkin emas). Buning o'rniga xatolik quyidagicha boshqariladi:

- `load()` — placeholder/yaroqsiz modelda `Interpreter.fromAsset` `ArgumentError`
  tashlaydi, ya'ni qaytgan `Future` **reject** bo'ladi. **Chaqiruvchi `load()`ni
  `try/catch` bilan o'rashi SHART** (masalan `FaceCubit` uni `Either<Failure,_>`ga
  o'girib beradi) — aks holda qurilmada real model qo'yilmaguncha tutilmagan
  istisno chiqadi.
- `embed()` — `load()` muvaffaqiyatli tugamagan bo'lsa (`_interpreter == null`),
  aniq `StateError` tashlaydi. Shu bir guard "hech yuklanmagan" va "yuklash
  muvaffaqiyatsiz" holatlarini bir xil qamrab oladi.

Build, `flutter analyze`, unit/widget testlar placeholder fayl bilan ham
**yashil** qoladi — chunki **birorta ham test interpreter'ni yuklamaydi**: yagona
unit test sof `FaceEmbedder.l2normalize(...)` yordamchi funksiyasi (model kerak
emas). Faqat qurilmada kameradan real kadr olib inference chaqirilganda, model
formati yaroqsizligi sababli xato ko'rinadi — bu real model qo'yilmaguncha
kutilgan holat.

## Real modelni joylashtirish tartibi

1. Litsenziyasi mos (OFL yoki Apache-2.0) MobileFaceNet `.tflite` faylini
   toping va litsenziya shartlarini tasdiqlang.
2. Uni aynan shu nom va yo'l bilan ushbu placeholder o'rniga qo'ying:
   `assets/models/mobilefacenet.tflite`.
3. Modelning haqiqiy kirish/chiqish o'lchamlarini tekshiring; kerak bo'lsa
   `kFaceInputSize` / `kFaceEmbeddingSize` konstantalarini moslang.
4. `flutter clean && flutter pub get`, so'ng qurilmada (simulyator emas —
   kamera kerak) qayta test qiling.
