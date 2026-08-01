import { PrismaClient } from '@prisma/client';
import { decodeUploadName } from '../src/common/upload-name.util';

/**
 * One-off repair of filenames that were stored mangled, before uploads started decoding them.
 *
 * Multipart has no way to declare the charset of `filename` (RFC 7578), so browsers send UTF-8
 * bytes and busboy decodes them as Latin-1: «пас олди.png» was stored as «Ð¿Ð°Ñ Ð¾Ð»Ð´Ð¸.png».
 * New uploads are decoded on the way in now; every row written before that is still wrong, and it
 * is what the operator sees in the document list and downloads as.
 *
 * Only `fileName` and `title` are touched. `storagePath` is deliberately NOT: the file on disk is
 * named by that string, and renaming a row without renaming the file loses the file.
 *
 * The same guard the upload path uses decides what to repair — a name that is genuinely Latin-1, or
 * plain ASCII, is left alone. Nothing is written unless the value actually changes.
 *
 * Run AFTER deploying, once:
 *   docker compose exec backend npx ts-node prisma/repair-filenames.ts
 * Add --dry to list what would change without writing.
 */
async function main() {
  const dry = process.argv.includes('--dry');
  const prisma = new PrismaClient();

  const docs = await prisma.document.findMany({ select: { id: true, fileName: true, title: true } });
  let changed = 0;

  for (const d of docs) {
    const fileName = decodeUploadName(d.fileName);
    const title = d.title == null ? null : decodeUploadName(d.title);
    const fileChanged = fileName !== d.fileName;
    const titleChanged = title !== d.title;
    if (!fileChanged && !titleChanged) continue;

    changed++;
    if (fileChanged) console.log(`  ${d.id}  ${d.fileName}  →  ${fileName}`);
    if (titleChanged) console.log(`  ${d.id}  [title] ${d.title}  →  ${title}`);
    if (!dry) {
      await prisma.document.update({
        where: { id: d.id },
        data: { ...(fileChanged ? { fileName } : {}), ...(titleChanged ? { title } : {}) },
      });
    }
  }

  console.log(`\n${docs.length} ta hujjat tekshirildi · ${changed} tasi ${dry ? 'tuzatilishi kerak' : 'tuzatildi'}`);
  if (dry && changed) console.log('Yozish uchun --dry siz qayta ishga tushiring.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
