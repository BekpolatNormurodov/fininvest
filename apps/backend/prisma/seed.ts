import { PrismaClient, Role, SellerKind } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  /*
    Lender master data (id 'default') — every document's letterhead and requisites block reads this.

    Copied cell by cell from the «Д0» sheet of the reference workbook «АВТО мфл APEX (2).xlsx», the
    owner's own current form. The spelling is theirs and is kept exactly: «шахар», «кучаси», «МЧЖ»
    after the name rather than before it.

    Two carried over unchanged and are worth a second look before the first real contract: the
    licence («61», 22.06.2019) is character-for-character what the previous organisation had, which
    reads more like a cell nobody edited than a coincidence, and both phone numbers are placeholder
    patterns («90-000-79-25»).

    The account and MFO are stored WITHOUT the «№» that sits in front of them in the sheet —
    doc-layout.ts prints «р/с: №…» itself, and keeping it here produced «№№».
  */
  const org = {
    tradeMark: 'FINCOM INVEST',
    nameMixed: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
    nameUpper: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
    nameSuffix: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
    // The reference prints the short form in the opening paragraph too — this is not an abbreviation
    // of some longer name we are missing.
    directorShort: 'Таджибаев А.Ю',
    directorFull: 'Таджибаев А.Ю',
    legalBasis: 'Низом',
    address: 'Тошкент шахар, Чилонзор тумани, Катта Чилонзор-3 МФЙ Чилонзор кучаси 82в-уй',
    bankAccount: '2021 6000 8073 0412 2001',
    bankMfo: '01196',
    bankName: '«APEX BANK» АЖ',
    phone: '90-000-79-25',
    phone2: '70-224-00-60',
    inn: '312 356 239',
    licenseNo: '61',
    licenseDate: new Date('2019-06-22T00:00:00Z'),
  };
  await prisma.organization.upsert({
    where: { id: 'default' },
    // An existing deployment carries the previous lender's details, so this has to overwrite rather
    // than only fill — otherwise the old name keeps printing on every new contract.
    update: org,
    create: { id: 'default', ...org },
  });

  const branch = await prisma.branch.upsert({
    where: { symbol: 'BR' },
    update: {},
    create: { name: 'Buxoro filiali', symbol: 'BR', region: 'Buxoro' },
  });

  const plainPassword = 'parol123';
  const password = await bcrypt.hash(plainPassword, 10);

  const users: { login: string; fullName: string; role: Role; branchId: string | null }[] = [
    { login: 'operator', fullName: 'Operator Ishchi', role: Role.OPERATOR, branchId: branch.id },
    { login: 'moderator', fullName: 'Moderator Nazoratchi', role: Role.MODERATOR, branchId: branch.id },
    { login: 'director', fullName: 'Direktor Rahbar', role: Role.DIRECTOR, branchId: null },
    { login: 'admin', fullName: 'Administrator', role: Role.ADMIN, branchId: null },
  ];

  for (const u of users) {
    // A moderator's inbox is scoped by `moderatedBranches` (the branches they oversee),
    // NOT by their personal `branchId` — see credit-cases.service `list()`/`scopeWhere()`.
    // So the seeded moderator must be connected to the branch here, or they see an empty
    // inbox even though branchId is set. (This was the bug: branchId set, relation empty.)
    const modBranch = u.role === Role.MODERATOR ? branch.id : null;
    await prisma.user.upsert({
      where: { login: u.login },
      update: {
        fullName: u.fullName,
        role: u.role,
        branchId: u.branchId,
        passwordHash: password,
        plainPassword,
        ...(modBranch ? { moderatedBranches: { set: [{ id: modBranch }] } } : {}),
      },
      create: {
        ...u,
        passwordHash: password,
        plainPassword,
        ...(modBranch ? { moderatedBranches: { connect: { id: modBranch } } } : {}),
      },
    });
  }

  // Catalog sellers (distributors) for asset-purchase products — reusable across cases so the
  // operator picks them instead of retyping. Demo names; replace with real partners in prod.
  const catalogSellers = [
    {
      id: 'seller-demo-developer',
      kind: SellerKind.LEGAL,
      orgName: 'Namuna Qurilish MChJ',
      stir: '300111222',
      directorName: 'Karimov Anvar',
      legalAddress: 'Toshkent sh., Yunusobod tumani',
      phone: '78 140-11-11',
      bankAccount: '20208000000000000011',
      bankName: 'АЖ «ANORBANK»',
      mfoCode: '01183',
      ownershipDoc: 'DDU / ulushli qurilish',
      category: 'REALTY',
      isCatalog: true,
    },
    {
      id: 'seller-demo-autosalon',
      kind: SellerKind.LEGAL,
      orgName: 'Namuna Motors avtosaloni',
      stir: '300333444',
      directorName: 'Rasulov Botir',
      legalAddress: 'Toshkent sh., Chilonzor tumani',
      phone: '78 140-22-22',
      bankAccount: '20208000000000000022',
      bankName: 'АЖ «ANORBANK»',
      mfoCode: '01183',
      ownershipDoc: 'Proforma-invoys',
      category: 'AUTO',
      isCatalog: true,
    },
  ];
  for (const s of catalogSellers) {
    await prisma.seller.upsert({ where: { id: s.id }, update: s, create: s });
  }

  // Auto-salon catalog for AVTO — names only for now; requisites are filled per deal or later.
  const AUTO_SALONS = [
    'UzAuto Motors avtosaloni', 'Roodell avtosaloni', 'ADM Motors', 'Chevrolet Toshkent',
    'Chevrolet Samarqand', 'Chery Uzbekistan', 'BYD Uzbekistan', 'KIA Toshkent',
    'Hyundai Uzbekistan', 'Changan Motors', 'Haval Uzbekistan', 'Geely Uzbekistan',
    'Lada Avto', 'Toyota Toshkent', 'Nissan Uzbekistan', 'MG Motor Uzbekistan',
    'JAC Motors', 'Foton Uzbekistan', 'Isuzu Uzbekistan', 'Mercedes-Benz Toshkent',
    'BMW Toshkent', 'Audi Uzbekistan', 'Volkswagen Uzbekistan', 'Skoda Uzbekistan',
    'Renault Uzbekistan', 'Peugeot Uzbekistan', 'Ravon Motors', 'Uz-Daewoo Auto',
    'Avtomir Toshkent', 'Zamon Auto', 'Mega Motors', 'Premium Auto salon',
    'Elite Motors', 'Grand Auto', 'Silk Road Motors', 'Buxoro Avto',
  ];
  for (let i = 0; i < AUTO_SALONS.length; i++) {
    const data = { id: `seller-salon-${i + 1}`, kind: SellerKind.LEGAL, orgName: AUTO_SALONS[i], category: 'AUTO', isCatalog: true };
    await prisma.seller.upsert({ where: { id: data.id }, update: data, create: data });
  }

  // Builder / developer catalog for IPOTEKA — names only for now.
  const BUILDERS = [
    'Xonsaroy', 'Golden House', 'Murad Buildings', 'Akfa Group', 'Orient Group',
    'Nawoiy Konstruksiya', 'Uzbek Development', 'Grand Nasaf', 'Poytaxt Builders',
    'Yangi Uzbekiston Qurilish', 'Bella Casa', 'Amir Temur Qurilish', 'Metropol Invest',
    'City Group qurilish', 'Elite Home', 'Toshkent City Builders', 'Nur Qurilish',
    'Zomin Development',
  ];
  for (let i = 0; i < BUILDERS.length; i++) {
    const data = { id: `seller-builder-${i + 1}`, kind: SellerKind.LEGAL, orgName: BUILDERS[i], category: 'REALTY', isCatalog: true };
    await prisma.seller.upsert({ where: { id: data.id }, update: data, create: data });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed tayyor. Login: operator/moderator/director/admin — parol: parol123');
  // eslint-disable-next-line no-console
  console.log(`✅ Katalog: ${AUTO_SALONS.length} avtosalon (AUTO) + ${BUILDERS.length} quruvchi (REALTY).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
