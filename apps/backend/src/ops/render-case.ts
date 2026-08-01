/*
  Loaded explicitly: run through `prisma` the CLI reads .env for us, but a plain `ts-node` does not,
  and the failure is a Prisma validation error about a missing DATABASE_URL rather than anything
  that points here.
*/
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { loadCaseForDocs } from '../output/documents/case-document.loader';
import { DOC_REGISTRY } from '../output/documents/registry';
import { PdfService } from '../output/pdf.service';

/**
 * Render every document of a real case to PDF, from live data.
 *
 * The same loader, the same registry and the same PdfService the running backend uses, so what
 * lands in the folder is what the operator would download — not a fixture and not an approximation.
 *
 *   docker compose exec backend npm run render:case -- BR-2026-0002
 *   docker compose exec backend npm run render:case -- BR-2026-0002 /tmp/hujjatlar
 *
 * Accepts the application number («BR-2026-0002»), the full contract number, or the row id. With no
 * argument it takes the three most recent cases that have collateral.
 *
 * Read-only: it opens the database, renders, and writes files. Nothing in the case is changed.
 */
async function main() {
  const [wanted, outArg] = process.argv.slice(2);
  const out = outArg || path.join(process.cwd(), 'rendered', wanted ? wanted.replace(/[^\w-]+/g, '_') : 'oxirgi');
  const prisma = new PrismaClient();
  const pdf = new PdfService();

  try {
    const cases = wanted
      ? await prisma.creditCase.findMany({
          where: { OR: [{ number: wanted }, { contractNumber: wanted }, { id: wanted }] },
          select: { id: true, number: true, contractNumber: true, product: true, status: true },
        })
      : await prisma.creditCase.findMany({
          where: { collaterals: { some: {} } },
          select: { id: true, number: true, contractNumber: true, product: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

    if (!cases.length) {
      console.error(`Ariza topilmadi: ${wanted ?? '(oxirgilar)'}`);
      process.exitCode = 1;
      return;
    }

    fs.mkdirSync(out, { recursive: true });

    for (const cc of cases) {
      console.log(`\n${cc.number}  ${cc.contractNumber ?? '(shartnoma raqami yo‘q)'}  ${cc.product ?? '(mahsulot yo‘q)'}  ${cc.status}`);
      const c = await loadCaseForDocs(prisma as never, cc.id);
      if (!c) { console.error('  yuklab bo‘lmadi'); continue; }

      const safe = String(cc.number).replace(/[^\w-]+/g, '_');
      let ok = 0;
      const failed: string[] = [];
      for (const [key, d] of Object.entries(DOC_REGISTRY)) {
        try {
          const buf = await pdf.render(d.build(c));
          fs.writeFileSync(path.join(out, `${safe}__${key}.pdf`), buf);
          ok++;
        } catch (e) {
          failed.push(`${key}: ${(e as Error).message}`);
        }
      }
      console.log(`  ${ok}/${Object.keys(DOC_REGISTRY).length} ta hujjat chiqdi`);
      // A template that throws is worth seeing by name — it means that document cannot be issued
      // for this case at all, which a count alone would hide.
      for (const f of failed) console.error(`  XATO  ${f}`);
    }

    console.log(`\nPapka: ${out}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
