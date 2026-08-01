# Undiruv (Collection) domeni — dizayn (SP-1)

> Manba talab: dala qarz-undirish tizimi. Bu hujjat **SP-1** — undiruv domeni (backend + web).
> Undan keyingi mustaqil loyihalar: **SP-2** tashrif yozuvlari + media, **SP-3** Flutter mobil app, **SP-4** yuz-tasdiq + fon lokatsiya.

**Maqsad:** kredit arizasi bo'yicha qarzdorlikni **qo'lda** belgilash (oylar + penya + shtraf), unga undiruvchi (COLLECTOR) biriktirish, va jarayonni web'da ro'yxat + statistika bilan kuzatish. Xabarlar (notification) muhim.

**Muhim kontekst:** tashqi bank cori tizimga **ulanmagan** — shuning uchun qarzdorlikni tizim avtomatik aniqlamaydi. Belgilash to'liq qo'lda: mas'ul xodim (admin / moderator / director) ariza ustida forma to'ldiradi. To'lov jadvali (`PaymentSchedule`) faqat **default qiymatlar** uchun yordamchi manba.

---

## 1. Ko'lam (scope) va chegaralar

SP-1 **kiritadi:**
- Yangi `COLLECTOR` roli va undiruvchi hisoblarini admin tomonidan boshqarish (CRUD, bir nechta filial).
- `Collection` (undiruv), `CollectionMonth` (to'lanmagan oy), `Notification` modellari.
- Undiruv yaratish/tahrirlash/biriktirish (bitta forma), rolga ko'ra ro'yxat va statistika.
- Xabarlar: belgilanганда operatorga, biriktirilганда undiruvchiga.
- Web: sidebar «Undiruv» bo'limi (ro'yxat + statistika + forma) va ariza sahifasidagi «Undiruvga qo'yish» tugmasi/paneli; admin uchun undiruvchilar boshqaruvi sahifasi.

SP-1 **kiritmaydi (kelajakdagi loyihalar):**
- Tashrif yozuvlari, geo-radius, foto/video, undirilgan summa harakatlari → **SP-2**.
- Mobil app (Flutter) → **SP-3**. SP-1 faqat undiruvchi hisobini yaratadi; mobil login/UX SP-3.
- Yuz-tasdiq, fon lokatsiya, hukumat API → **SP-4**.

`collectedAmount` (undirilgan summa) SP-1'da model sifatida mavjud, lekin qiymati **0** — uni SP-2 tashriflar to'ldiradi. Statistika shu maydonga tayanadi, shuning uchun hozir kiritiladi.

---

## 2. Ma'lumot modeli (Prisma)

### 2.1 Role
`enum Role`ga `COLLECTOR` qo'shiladi.

### 2.2 Yangi enum
```prisma
enum CollectionStatus {
  NEW          // yaratilgan, undiruvchi biriktirilmagan
  ASSIGNED     // undiruvchi biriktirilgan, hali harakat yo'q
  IN_PROGRESS  // undiruvchi ish boshlagan (SP-2 tashriflar bo'lganda)
  CLOSED       // yopilgan (to'liq undirilgan yoki qo'lda yopilgan)
}
```

### 2.3 `Collection` (undiruv)
```prisma
model Collection {
  id                  String            @id @default(cuid())
  case                CreditCase        @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId              String
  status              CollectionStatus  @default(NEW)
  months              CollectionMonth[]
  penalty             Decimal           @default(0) @db.Decimal(18, 2)  // penya
  fine                Decimal           @default(0) @db.Decimal(18, 2)  // shtraf
  totalDebt           Decimal           @default(0) @db.Decimal(18, 2)  // Σ oylar + penya + shtraf (saqlanadi)
  collectedAmount     Decimal           @default(0) @db.Decimal(18, 2)  // SP-2 to'ldiradi
  note                String?           @db.Text
  assignedCollector   User?             @relation("CollectionCollector", fields: [assignedCollectorId], references: [id])
  assignedCollectorId String?
  assignedBy          User?             @relation("CollectionAssignedBy", fields: [assignedById], references: [id])
  assignedById        String?
  assignedAt          DateTime?
  createdBy           User              @relation("CollectionCreatedBy", fields: [createdById], references: [id])
  createdById         String
  closedAt            DateTime?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@index([caseId])
  @@index([assignedCollectorId])
  @@index([status])
}
```

`totalDebt` **saqlanadi** (denormalizatsiya) — ro'yxat/statistika tez bo'lsin. Yagona manba: har `PATCH`/`POST`da `collectionTotal()` (shared, pure) qayta hisoblab yozadi.

### 2.4 `CollectionMonth` (to'lanmagan oy)
```prisma
model CollectionMonth {
  id            String     @id @default(cuid())
  collection    Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  collectionId  String
  year          Int
  month         Int        // 1..12
  plannedAmount Decimal    @default(0) @db.Decimal(18, 2) // jadvaldagi oylik to'lov (default)
  amount        Decimal    @default(0) @db.Decimal(18, 2) // kiritilgan qarzdorlik summasi

  @@unique([collectionId, year, month])
  @@index([collectionId])
}
```

### 2.5 `Notification`
```prisma
model Notification {
  id        String   @id @default(cuid())
  user      User     @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  type      String   // 'COLLECTION_CREATED' | 'COLLECTION_ASSIGNED' | ...
  title     String
  body      String?  @db.Text
  caseId    String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
  @@index([createdAt])
}
```

### 2.6 `User` / `Branch` / `CreditCase` munosabatlari
- `User`: `collectedBranches Branch[] @relation("BranchCollectors")` (undiruvchi qamragan filiallar, m-n — moderatorlardagi kabi), `assignedCollections Collection[] @relation("CollectionCollector")`, `assignedByCollections Collection[] @relation("CollectionAssignedBy")`, `createdCollections Collection[] @relation("CollectionCreatedBy")`, `notifications Notification[] @relation("UserNotifications")`.
- `Branch`: `collectors User[] @relation("BranchCollectors")`.
- `CreditCase`: `collections Collection[]`.

**Migratsiya:** loyiha `prisma db push`dan foydalanadi (migration papkasi emas). Schema o'zgargach `npm run db:generate -w @credit-core/backend` va lokal `npx prisma db push`.

---

## 3. Biznes qoidalari

- **Bitta arizada bir vaqtda bitta FAOL undiruv** (status ≠ CLOSED). Yangi undiruv ochishda ochiq borligini tekshiramiz; bor bo'lsa xato (`409`). Yopilgan undiruvlar tarixda qoladi — ariza qayta undiruvga tushishi mumkin.
- **Jami:** `totalDebt = Σ months[].amount + penalty + fine` — `collectionTotal()` (shared, pure).
- **Qoldiq:** `remaining = totalDebt − collectedAmount` (SP-2gacha = totalDebt).
- **Default oy summasi:** oyni tanlaganда `plannedAmount` = ariza to'lov jadvalidagi oylik annuitet; xodim `amount`ni tahrirlaydi (default = planned).
- **Status o'tishi:** NEW → (undiruvchi tanlansa) ASSIGNED → (SP-2 tashrif) IN_PROGRESS → (yopilса) CLOSED. SP-1'da forma undiruvchi bilan saqlansa darrov ASSIGNED.

---

## 4. Ruxsatlar (authorization)

| Amal | ADMIN | DIRECTOR | MODERATOR | OPERATOR | COLLECTOR |
|---|:--:|:--:|:--:|:--:|:--:|
| Undiruv yaratish/tahrirlash/biriktirish | ✅ | ✅ | ✅ | — | — |
| Undiruv o'chirish (yopilmaganini) | ✅ | ✅ | — | — | — |
| Undiruvlar ro'yxati / statistika | ✅ hammasi | ✅ o'z filial(lar)i | ✅ moderatsiya filiallari | ✅ faqat o'z arizalari | (web yo'q) |
| Undiruvchi hisoblari CRUD | ✅ | — | — | — | — |

**Filial-scoping** mavjud arizalar ro'yxatidagi pattern bilan bir xil: DIRECTOR/MODERATOR o'z filial(lar)i bo'yicha, OPERATOR `createdById = user.id`, ADMIN cheklovsiz. `Collection` filiali = `case.branchId` orqali.

---

## 5. Xabarlar (Notification) oqimi

| Hodisa | Kim oladi | type |
|---|---|---|
| Undiruv yaratildi (qarzdorlik belgilandi) | arizaning operatori (`case.createdById`) | `COLLECTION_CREATED` |
| Undiruvchi biriktirildi | biriktirilgan undiruvchi | `COLLECTION_ASSIGNED` |
| (SP-2) Undiruvchi tashrif/summa kiritdi | undiruvni belgilagan/biriktirgan (`assignedById`/`createdById`) | `COLLECTION_PROGRESS` |

SP-1 birinchi ikkitasini yozadi. `Notification` DB yozuvi — web unread badge (mavjud AppShell badge patterni) va keyinchalik mobil push (SP-3/SP-4) shundan o'qiydi. Notification yaratish undiruv tranzaksiyasi ichida, lekin **best-effort** (xato bo'lsa asosiy amal buzilmaydi).

---

## 6. Backend API

`CollectionsModule`, `CollectorsModule` (yoki `UsersModule` kengaytmasi), `NotificationsModule`. Barcha endpointlar JWT-himoyalangan; rol guardi bilan cheklangan.

```
POST   /collections            {caseId, months[], penalty, fine, note, assignedCollectorId?}  → Collection
GET    /collections            (rolga ko'ra scoped; ?status,&collectorId,&branchId,&from,&to)  → CollectionListItem[]
GET    /collections/:id                                                                        → Collection (months, collector, case)
PATCH  /collections/:id        {months?, penalty?, fine?, note?, assignedCollectorId?, status?} → Collection
DELETE /collections/:id        (yopilmaganini; ADMIN/DIRECTOR)                                  → void
GET    /collections/stats      (rolga ko'ra scoped; bir xil filtrlar)                           → CollectionStats

GET    /collectors             (ADMIN)                                                          → CollectorListItem[]
POST   /collectors             {fullName, login, password, phone, branchIds[]}                  → Collector
PATCH  /collectors/:id         {fullName?, phone?, branchIds?, isActive?, password?}            → Collector
DELETE /collectors/:id         (soft: isActive=false)                                           → void

GET    /notifications          (o'z foydalanuvchisiniki; ?unread)                               → Notification[]
POST   /notifications/:id/read                                                                  → void
POST   /notifications/read-all                                                                  → void
```

Request DTOlari — mavjud konvensiya bo'yicha (class-validator local yoki shared; explorer natijasiga moslanadi). Javob turlari `@credit-core/shared`da.

---

## 7. Shared paket

- **Enum:** `CollectionStatus`.
- **DTO/interfeys:** `CollectionMonthDto`, `CreateCollectionDto`, `UpdateCollectionDto`, `Collection`, `CollectionListItem`, `CollectionStats`, `Collector`, `CollectorListItem`, `CreateCollectorDto`, `Notification`.
- **Pure funksiyalar (+ jest spec):**
  - `collectionTotal({ months, penalty, fine }): number` — Σ + penya + shtraf.
  - `collectionRemaining(total, collected): number`.
  - `collectionStats(rows: CollectionListItem[]): CollectionStats` — jami qarzdorlik/undirilgan/qoldiq+foiz, undiruvchi bo'yicha, holat bo'yicha, filial bo'yicha. `matchesCaseFilter`/`case-filter.ts` uslubida — brauzersiz testlanadi.
- Barreldan (`index.ts`) eksport; `dist` build (backend `@credit-core/shared`ni dist'dan iste'mol qiladi).

---

## 8. Web UI

- **Sidebar → «Undiruv»** (admin/moderator/director/operator; rolga qarab ko'lam):
  - Statistika kartalari: jami qarzdorlik · undirilgan · qoldiq (+foiz) · faol undiruvlar.
  - Undiruvchilar bo'yicha / holat bo'yicha / filial bo'yicha kesimlar.
  - `DataTable` + filtrlar (holat/undiruvchi/filial/sana) — mavjud `useCaseFilters` uslubi.
  - «Yangi undiruv» → ariza tanlash → forma.
- **Undiruv formasi** (modal/sahifa): oy multi-select (shu oy + oldingilar, default oylik to'lov), har oy summasi tahrirlanadi, penya, shtraf, **jami avto**, undiruvchi tanlash → Saqlash.
- **Ariza sahifasi:** «Undiruvga qo'yish» tugmasi; undiruv bor bo'lsa panel (holat, undiruvchi, jami, undirilgan, qoldiq).
- **Admin → Undiruvchilar:** mavjud foydalanuvchi-boshqaruv sahifasi uslubida CRUD; bir nechta filial tanlash.

Marshrutlar 4 web app'ga ulanadi (rolga ko'ra); komponentlar `packages/ui`da. i18n string'lar mavjud tizim bo'yicha.

---

## 9. Test strategiyasi

**Shared (jest, brauzersiz):**
- `collectionTotal` — oylar + penya + shtraf; bo'sh; kasrli.
- `collectionRemaining` — collected < / = / > total.
- `collectionStats` — bir nechta qatordan jami, holat/undiruvchi/filial kesimlari, bo'sh ro'yxat.

**Backend (jest):**
- `collectionTotal` server tomonda saqlanishi (POST → totalDebt to'g'ri).
- Bitta arizada ikkinchi faol undiruv → 409.
- Ruxsat: OPERATOR yarata olmaydi; MODERATOR yarata oladi.
- Rolga ko'ra ro'yxat scoping: DIRECTOR faqat filialini, OPERATOR faqat o'zinikini ko'radi.
- Undiruvchi biriktirilganda status=ASSIGNED va `COLLECTION_ASSIGNED` notification yaratiladi; yaratilganda `COLLECTION_CREATED` operatorga.
- Collector CRUD: ko'p filial saqlanadi; login unique; soft-delete.

Buyruqlar: `npm run build -w @credit-core/shared` (backend jestdan oldin), keyin backend jest to'plami; UI typecheck (operator/admin/director/moderator).

---

## 10. Xavflar / ochiq savollar

- **Notification model minimal** — kelajakda mobil push (SP-4) uchun kengaytiriladi; hozir DB + web unread yetarli.
- **collectedAmount SP-2'gача 0** — statistika «undirilgan 0%» ko'rsatadi; bu kutilgan holat, UIда izohlanadi.
- **Filial-scoping manbasi** `case.branchId` — undiruvchining `collectedBranches`i faqat mobil ko'rish (SP-3) uchun; SP-1 biriktirishda undiruvchi filiali arizanikiga mos kelishini **tavsiya** qiladi (majburiy emas).
