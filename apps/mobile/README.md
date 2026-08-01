# FinInvest Undiruv — mobil ilova (Flutter)

Dala undiruvchilari (COLLECTOR) uchun mobil ilova. Backend'dagi undiruv (collection) domeniga **haqiqiy API** orqali ulanadi.

## Arxitektura (clean architecture)

```
lib/
  main.dart                # ensureInitialized → DI → runApp
  app/                     # app root, theme, router, home shell
  core/
    config/                # API base URL (--dart-define)
    network/               # dio klient + interceptor, network checker, xato mapping
    storage/               # secure token store (7 kunlik sessiya)
    di/                    # get_it service locator
    widgets/               # logo, loading/error/empty
    format.dart            # pul / sana formatlash
  features/
    auth/                  # splash, login, profil, logout — data/domain/presentation
    collections/           # undiruvlar ro'yxati (2 tab) + detal
```

- **State:** `flutter_bloc` (Cubit). **DI:** `get_it`. **Network:** `dio` + interceptor (bearer token).
- **Ikonalar:** `iconsax`. **Routing:** `go_router` (auth-redirect bilan).
- **Network checker:** `connectivity_plus` — offline banner.

## Haqiqiy API bilan ishga tushirish

Backend `/api` prefiksida ishlaydi. Emulyatordan host — `10.0.2.2`.

```bash
# Android emulator (default):
flutter run

# Boshqa API manzil:
flutter run --dart-define=API_URL=http://192.168.1.10:3000/api
```

Undiruvchi hisobi **admin panelida** (web) yaratiladi (login/parol). Shu login/parol bilan kiriladi; JWT 7 kun amal qiladi (haftalik sessiya).

## Nima bor (SP-3, birinchi bosqich)

- Splash → stored token tekshiruvi → login yoki home.
- Login (login/parol), xatolar snackbar'da.
- Undiruvlar ro'yxati: **«Umumiy (filial)»** va **«Menga biriktirilgan»** tablari, pull-to-refresh.
- Undiruv detali: oylar, penya, shtraf, jami, undirilgan, qoldiq, izoh.
- Profil + logout (tasdiq modal).
- Logo, launcher icon, Android/iOS ruxsatlari (joylashuv, kamera, media).

## Keyingi bosqichlar (SP-4)

Xarita + 200 m radius, tashrif kiritish (summa, xatlar, foto/video), yuz-tasdiq, fon lokatsiya, chat. Ruxsatlar manifestlarda allaqachon e'lon qilingan.

## Buyruqlar

```bash
flutter pub get
flutter analyze
flutter test
dart run flutter_launcher_icons   # ikonalarni qayta generatsiya qilish
```
