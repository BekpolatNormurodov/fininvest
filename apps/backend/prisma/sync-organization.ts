/*
  Loaded explicitly: run through `prisma` the CLI reads .env for us, but a plain `ts-node` does not,
  and the failure is a Prisma validation error about a missing DATABASE_URL rather than anything
  that points here.
*/
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ORGANIZATION } from './organization.data';

/**
 * Update the lender's own details, and nothing else.
 *
 * A deployment that has been running carries the PREVIOUS lender in its Organization row, and
 * `prisma db push` does not touch data — so every contract, бош келишув and cover it prints keeps
 * naming the old firm, its old bank and its old INN, however much the templates changed.
 *
 * The full seed would fix that, and must not be used for it: it also upserts the four seeded logins
 * with `passwordHash` in the update, so running it on a live system resets the operator's,
 * moderator's, director's and admin's passwords.
 *
 * This writes one row.
 *
 *   docker compose exec backend npm run sync:org -- --dry
 *   docker compose exec backend npm run sync:org
 */
async function main() {
  const dry = process.argv.includes('--dry');
  const prisma = new PrismaClient();
  try {
    const before = await prisma.organization.findUnique({ where: { id: 'default' } });

    const changed: string[] = [];
    for (const [k, v] of Object.entries(ORGANIZATION)) {
      const old = (before as Record<string, unknown> | null)?.[k];
      const oldStr = old instanceof Date ? old.toISOString() : String(old ?? '');
      const newStr = v instanceof Date ? v.toISOString() : String(v);
      if (oldStr !== newStr) changed.push(`  ${k}\n     eski: ${oldStr || '(yo‘q)'}\n     yangi: ${newStr}`);
    }

    if (!before) console.log('Tashkilot yozuvi yo‘q — yaratiladi.');
    else if (!changed.length) console.log('Tashkilot ma’lumotlari allaqachon to‘g‘ri — o‘zgarish yo‘q.');
    else { console.log(`${changed.length} ta maydon o‘zgaradi:\n`); console.log(changed.join('\n')); }

    if (dry) { console.log('\n--dry — hech narsa yozilmadi.'); return; }
    if (before && !changed.length) return;

    await prisma.organization.upsert({
      where: { id: 'default' },
      update: ORGANIZATION,
      create: { id: 'default', ...ORGANIZATION },
    });
    console.log('\nYozildi.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
