import { Controller, Get, Param, Query, Res, UseGuards, NotFoundException, ConflictException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PdfService } from './pdf.service';
import { loadCaseForDocs } from './documents/case-document.loader';
import { assetInsuranceLabelCyr, type LoanProduct } from '@credit-core/shared';
import { docBadgeForStatus, watermarkForStatus } from './documents/doc-layout';
import { DOC_REGISTRY, type DocAppliesTo } from './documents/registry';

/** A document applies unless it is pinned to the other product family. Cash/legacy see 'both'+'cash'. */
function docApplies(appliesTo: DocAppliesTo | undefined, isAsset: boolean): boolean {
  const a = appliesTo ?? 'both';
  return a === 'both' || (a === 'asset') === isAsset;
}
import { exportScheduleToExcel } from './excel-export.util';
import { SignedDocsStore } from '../signing/signed-docs.store';

@UseGuards(JwtAuthGuard)
@Controller('cases/:id/documents')
export class CaseDocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly signedDocs: SignedDocsStore,
  ) {}

  @Get()
  async list(@Param('id') id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id }, select: { status: true, product: true } });
    if (!c) throw new NotFoundException('case not found');
    const isAsset = assetInsuranceLabelCyr(c.product as LoanProduct | null) !== null;
    // 'review' docs make sense as soon as the case leaves DRAFT; 'approved' docs (notary copies,
    // monitoring acts) only make sense once the director has signed off — FINALIZED, or the legacy
    // ADMIN_FINALIZE status that predates the current terminal-at-director-approval workflow.
    const reviewAvailable = c.status !== 'DRAFT';
    const approvedAvailable = c.status === 'FINALIZED' || (c.status as string) === 'ADMIN_FINALIZE';
    // Badge shown per document: "Tasdiqlanmagan" under review → "Tasdiqlangan" once the director signs.
    const badge = docBadgeForStatus(c.status);
    return Object.entries(DOC_REGISTRY).filter(([, d]) => docApplies(d.appliesTo, isAsset)).map(([key, d]) => {
      const available = d.stage === 'approved' ? approvedAvailable : reviewAvailable;
      return {
        key,
        title: d.title,
        lang: d.lang,
        category: d.category,
        stage: d.stage,
        available,
        badge: available ? badge : null,
      };
    });
  }

  @Get(':key/pdf')
  async getPdf(
    @Param('id') id: string,
    @Param('key') key: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const tpl = DOC_REGISTRY[key];
    if (!tpl) throw new NotFoundException('unknown document');
    const c = await loadCaseForDocs(this.prisma, id);
    if (!c) throw new NotFoundException('case not found');
    if (c.status === 'DRAFT') throw new ConflictException('hujjat hali mavjud emas (qoralama)');
    // Product gate mirrors list(): a direct URL can't fetch a doc that doesn't apply to this product.
    if (!docApplies(tpl.appliesTo, assetInsuranceLabelCyr(c.product as LoanProduct | null) !== null)) {
      throw new NotFoundException('Bu hujjat ushbu kredit turi uchun mavjud emas');
    }

    /*
      Once the director has signed, the frozen file IS the issued document — it is the bytes their
      key covers, and it carries the QR the signature is verified through. Re-rendering here would
      hand out a different document from the one that was signed the moment any case data changed.
    */
    const frozen = await this.signedDocs.read(id, key);
    if (frozen) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${download === '1' ? 'attachment' : 'inline'}; filename="${key}_${c.number}.pdf"`,
      );
      res.send(frozen);
      return;
    }
    // Server-side stage gate (mirrors list()): 'approved' docs (notary copies, monitoring acts) can
    // only be generated once the director has signed off — so a direct URL can't bypass the UI lock.
    if (tpl.stage === 'approved' && c.status !== 'FINALIZED' && (c.status as string) !== 'ADMIN_FINALIZE') {
      throw new ConflictException('Bu hujjat direktor tasdig‘idan keyin mavjud bo‘ladi');
    }

    const def = tpl.build(c);
    const wm = watermarkForStatus(c.status);
    if (wm) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (def as any).watermark = { text: wm.text, color: wm.color, opacity: 0.12, angle: -40, bold: true };
    }

    const buffer = await this.pdf.render(def);
    const fileName = `${key}_${c.number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${download === '1' ? 'attachment' : 'inline'}; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get('grafik/xlsx')
  async getScheduleExcel(@Param('id') id: string, @Res() res: Response) {
    const c = await loadCaseForDocs(this.prisma, id);
    if (!c) throw new NotFoundException('case not found');
    if (c.status === 'DRAFT') throw new ConflictException('hujjat hali mavjud emas (qoralama)');

    const buffer = await exportScheduleToExcel(c);
    const fileName = `Grafik_${c.number}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
