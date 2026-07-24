import { PrismaClient, Role, SellerKind } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Lender master data (id 'default') — document letterhead/requisites read this.
  await prisma.organization.upsert({
    where: { id: 'default' },
    update: { tradeMark: 'PULMAKON' }, // backfill the trademark on existing deployments
    create: {
      id: 'default',
      tradeMark: 'PULMAKON',
      nameMixed: 'МЧЖ «CLEVER Mikromoliya Tashkiloti»',
      nameUpper: 'МЧЖ «CLEVER MIKROMOLIYA TASHKILOTI»',
      nameSuffix: '«CLEVER MIKROMOLIYA TASHKILOTI» МЧЖ',
      directorShort: 'Б.Исмоилов',
      directorFull: 'Исмоилов Баҳромжон Ахрор ўғли',
      address: 'Тошкент шахар, Олмазор тумани, Сагбон 30 берк кўча, 6 уй',
      bankAccount: '20216000105068380006',
      bankMfo: '01183',
      bankName: 'АЖ «ANORBANK»',
      phone: '78 113-31-33',
      inn: '306365847',
      licenseNo: '61',
      licenseDate: new Date('2019-06-22T00:00:00Z'),
    },
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
    await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, role: u.role, branchId: u.branchId, passwordHash: password, plainPassword },
      create: { ...u, passwordHash: password, plainPassword },
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
    const data = { id: `seller-salon-${i + 1}`, kind: SellerKind.LEGAL, orgName: AUTO_SALONS[i], isCatalog: true };
    await prisma.seller.upsert({ where: { id: data.id }, update: data, create: data });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed tayyor. Login: operator/moderator/director/admin — parol: parol123');
  // eslint-disable-next-line no-console
  console.log(`✅ ${catalogSellers.length + AUTO_SALONS.length} ta katalog sotuvchi (${AUTO_SALONS.length} avtosalon) qo'shildi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
