import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CaseStatus, Role, WorkflowDecision, findTransition } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../auth/current-user.decorator';
import { PdfService } from '../output/pdf.service';
import { loadCaseForDocs, CaseDocData } from '../output/documents/case-document.loader';
import { DOC_REGISTRY } from '../output/documents/registry';
import { watermarkForStatus } from '../output/documents/doc-layout';
import { caseQrDataUrl, withVerificationBlock } from '../output/documents/verification-block';
import { buildManifest, manifestBytes, manifestSha256, sha256, type CaseManifest, type ManifestDoc } from './manifest';
import { SignedDocsStore } from './signed-docs.store';
import { extractCertInns, signatureCarriesInn } from './cert-inn';

/** A signing attempt is one human typing one password. Anything older is abandoned. */
const CHALLENGE_TTL_MS = 10 * 60_000;

/**
 * Director signing.
 *
 * Two calls, because the director signs *bytes* and the server has to know exactly which bytes it
 * handed out. Rendering first and committing only once the signature comes back also resolves the
 * apparent circularity — the documents carry the ТАСДИҚЛАНГАН watermark and a QR, both of which
 * need a signed case, which needs the documents.
 */
@Injectable()
export class SigningService {
  private readonly log = new Logger(SigningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pdf: PdfService,
    private readonly store: SignedDocsStore,
  ) {}

  /** Only the director, only from DIRECTOR_REVIEW — resolved from the shared workflow rules. */
  private async loadSignable(id: string, user: RequestUser): Promise<CaseDocData> {
    const c = await loadCaseForDocs(this.prisma, id);
    if (!c) throw new NotFoundException('Ariza topilmadi');
    const rule = findTransition(c.status as CaseStatus, user.role as Role, WorkflowDecision.APPROVE);
    if (!rule || rule.to !== CaseStatus.FINALIZED) {
      throw new ForbiddenException('Bu holatda imzolab bo‘lmaydi');
    }
    // NB: the down-payment receipt is deliberately NOT gated here. The correct order is: the director
    // approves first, THEN the client pays the down payment at the bank and brings the receipt, which
    // the operator uploads afterwards. So requiring it before signing would be backwards.
    return c;
  }

  /**
   * Which key the director must use, so the dialog can rule out the wrong ones before they type a
   * password rather than after. The commit-side check is the one that decides; this only spares
   * them the wasted attempt.
   */
  async keyRequirement() {
    const org = await this.prisma.organization.findFirst({ select: { nameUpper: true, inn: true } });
    return { orgName: org?.nameUpper ?? null, inn: org?.inn?.trim() ?? null };
  }

  /**
   * Render and freeze the whole set, then hand back the manifest to sign.
   *
   * Documents are rendered as the case *will be* once the signature lands — FINALIZED watermark,
   * QR present. That is not a lie about the current row: it is what the files will attest once the
   * caller commits, and they are deleted again if it does not.
   */
  async prepare(id: string, user: RequestUser) {
    const c = await this.loadSignable(id, user);

    // Render against the post-signature status so the frozen files carry the right watermark and
    // the 'approved'-stage documents (notary copies, monitoring acts) come out at all.
    const signedView = { ...c, status: CaseStatus.FINALIZED } as CaseDocData;
    const wm = watermarkForStatus(CaseStatus.FINALIZED);
    const qr = await caseQrDataUrl(c.id);

    const docs: ManifestDoc[] = [];
    try {
      for (const [key, tpl] of Object.entries(DOC_REGISTRY)) {
        const def = withVerificationBlock(tpl.build(signedView), signedView, qr);
        if (wm) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (def as any).watermark = { text: wm.text, color: wm.color, opacity: 0.12, angle: -40, bold: true };
        }
        const pdf = await this.pdf.render(def);
        await this.store.write(c.id, key, pdf);
        docs.push({ key, file: this.store.fileName(key), sha256: sha256(pdf), bytes: pdf.length });
      }
    } catch (err) {
      // A half-frozen set is worse than none: it would let a later commit sign whatever happened
      // to be written before the failure.
      await this.store.removeAll(c.id);
      const reason = err instanceof Error ? err.message : String(err);
      this.log.error(`[sign] render failed case=${c.number} (${c.id}) by=${user.id}: ${reason}`);
      throw new ConflictException('Hujjatlarni tayyorlashda xatolik');
    }

    const manifest = buildManifest({
      caseId: c.id,
      caseNumber: c.number,
      contractNumber: c.contractNumber,
      orgName: c.organization?.nameUpper ?? '—',
      orgInn: c.organization?.inn ?? null,
      signedAt: new Date(),
      docs,
    });
    const digest = manifestSha256(manifest);

    // One live attempt per case — a stale challenge must not be completable later.
    await this.prisma.caseSignChallenge.deleteMany({ where: { caseId: c.id } });
    const challenge = await this.prisma.caseSignChallenge.create({
      data: {
        caseId: c.id,
        userId: user.id,
        manifestSha256: digest,
        manifest: manifest as unknown as object,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    this.log.log(`[sign] prepare case=${c.number} (${c.id}) by=${user.id} docs=${docs.length} sha=${digest.slice(0, 16)}`);
    return {
      challengeId: challenge.id,
      manifestBase64: manifestBytes(manifest).toString('base64'),
      docCount: docs.length,
    };
  }

  /**
   * Accept the signature.
   *
   * Every frozen file is re-read and re-hashed here. A second `prepare` would have replaced them,
   * and committing then would file a signature against bytes nobody signed.
   */
  async commit(
    id: string,
    user: RequestUser,
    body: { challengeId: string; pkcs7: string; signerInfo?: unknown },
  ) {
    const c = await this.loadSignable(id, user);

    if (typeof body.pkcs7 !== 'string' || body.pkcs7.length < 100) {
      await this.audit.signFailed(user, id, 'commit', 'no pkcs7 in request');
      throw new BadRequestException('Imzo kelmadi');
    }

    /*
      Only the firm's own key may sign — not a director's personal key, not another company's.
      The INN in the certificate is what tells them apart.

      Fails closed, including when the organisation has no INN configured: an unconfigured INN
      means the check cannot be made, and a check that cannot be made must not pass. The message
      names what was actually found so a single refused attempt says why, rather than sending
      someone to guess which of their keys is wrong.
    */
    const orgInn = c.organization?.inn?.trim();
    if (!orgInn) {
      await this.audit.signFailed(user, id, 'commit', 'organisation has no INN configured');
      throw new ConflictException('Tashkilot INN sozlanmagan — imzolab bo‘lmaydi. Administratorga murojaat qiling');
    }
    if (!signatureCarriesInn(body.pkcs7, orgInn)) {
      const found = extractCertInns(body.pkcs7);
      await this.audit.signFailed(
        user, id, 'commit',
        `key INN mismatch: expected ${orgInn}, certificate carried ${found.length ? found.join(', ') : 'none'}`,
      );
      this.log.warn(
        `[sign] key rejected case=${c.number} (${c.id}) by=${user.id} expected=${orgInn} found=${found.join(',') || 'none'}`,
      );
      throw new ForbiddenException(
        found.length
          ? `Bu kalit tashkilotga tegishli emas (kalit INN: ${found.join(', ')}, kerak: ${orgInn}). Firma kaliti bilan imzolang`
          : `Kalitda tashkilot INN topilmadi (kerak: ${orgInn}). Shaxsiy kalit emas, firma kaliti bilan imzolang`,
      );
    }

    const challenge = await this.prisma.caseSignChallenge.findUnique({ where: { id: body.challengeId ?? '' } });
    if (!challenge || challenge.caseId !== c.id || challenge.userId !== user.id) {
      await this.audit.signFailed(user, id, 'commit', 'challenge not found / not theirs');
      throw new BadRequestException('Imzolash seansi topilmadi — qaytadan boshlang');
    }
    if (challenge.expiresAt < new Date()) {
      await this.prisma.caseSignChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      await this.audit.signFailed(user, id, 'commit', 'challenge expired');
      throw new BadRequestException('Imzolash seansi eskirdi — qaytadan boshlang');
    }

    // Rebuild the manifest from what is actually on disk right now.
    const docs: ManifestDoc[] = [];
    for (const key of Object.keys(DOC_REGISTRY)) {
      const pdf = await this.store.read(c.id, key);
      if (!pdf) {
        await this.audit.signFailed(user, id, 'commit', `frozen document missing: ${key}`);
        throw new ConflictException('Hujjat o‘zgargan — qaytadan imzolang');
      }
      docs.push({ key, file: this.store.fileName(key), sha256: sha256(pdf), bytes: pdf.length });
    }
    // Race guard, not a status check: `loadSignable` already refused anything but DIRECTOR_REVIEW,
    // but two commits fired at once would both pass it. The unique constraint on caseId would
    // catch this anyway — this turns a 500 into an answer the director can read.
    const signed = await this.prisma.caseSignature.findUnique({ where: { caseId: c.id } });
    if (signed) throw new ConflictException('Ariza allaqachon imzolangan');

    /*
      Rebuild the manifest from the files as they are now and check it still hashes to what the
      challenge was issued for. `signedAt` comes from the stored manifest — prepare stamped it and
      it cannot be recomputed — so the only thing that can move the digest here is the documents
      themselves, which is exactly what this check is for.
    */
    const issued = challenge.manifest as unknown as CaseManifest;
    const rebuilt = buildManifest({
      caseId: c.id,
      caseNumber: c.number,
      contractNumber: c.contractNumber,
      orgName: c.organization?.nameUpper ?? '—',
      orgInn: c.organization?.inn ?? null,
      signedAt: new Date(issued.signedAt),
      docs,
    });
    if (manifestSha256(rebuilt) !== challenge.manifestSha256) {
      await this.audit.signFailed(user, id, 'commit', 'frozen documents no longer match the challenge');
      throw new ConflictException('Hujjatlar o‘zgargan — qaytadan imzolang');
    }

    const rule = findTransition(c.status as CaseStatus, user.role as Role, WorkflowDecision.APPROVE)!;
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.creditCase.update({
        where: { id: c.id },
        data: { status: rule.to, signedAt: now, docsFrozenAt: now, stepStartedAt: null, stepDeadlineAt: null },
      }),
      this.prisma.caseSignature.create({
        data: {
          caseId: c.id,
          pkcs7: body.pkcs7,
          manifest: rebuilt as unknown as object,
          manifestSha256: challenge.manifestSha256,
          // Recorded as false on purpose: nobody has checked this signature, and the row should not
          // read as if someone had. Checking needs E-IMZO-SERVER and a NIC contract.
          verified: false,
          signerInfo: (body.signerInfo ?? undefined) as never,
          signedById: user.id,
        },
      }),
      this.prisma.workflowEvent.create({
        data: {
          caseId: c.id,
          fromStatus: c.status as CaseStatus,
          toStatus: rule.to,
          decision: WorkflowDecision.APPROVE,
          actorId: user.id,
          role: user.role as Role,
          comment: null,
        },
      }),
      this.prisma.caseSignChallenge.delete({ where: { id: challenge.id } }),
    ]);

    const keyName = (body.signerInfo as { name?: string } | null)?.name ?? 'unknown';
    await this.audit.sign(user, c.id, challenge.manifestSha256, keyName);
    this.log.log(`[sign] signed case=${c.number} (${c.id}) by=${user.id} key=${keyName} verified=false`);
    return { ok: true, status: rule.to };
  }

  /**
   * The browser reporting that E-IMZO refused. Nothing is written to the case — a failed attempt
   * must leave no trace on the documents — but the attempt is audited and the challenge dropped,
   * so the frozen-but-unsigned set cannot be completed later.
   */
  async fail(id: string, user: RequestUser, body: { challengeId?: string | null; stage?: string; error?: string }) {
    const stage = typeof body.stage === 'string' ? body.stage.slice(0, 40) : 'unknown';
    const error = typeof body.error === 'string' ? body.error : String(body.error ?? '');
    await this.audit.signFailed(user, id, stage, error);
    this.log.warn(`[sign] failed case=${id} by=${user.id} stage=${stage} eimzo=${error.slice(0, 200)}`);

    if (body.challengeId) {
      await this.prisma.caseSignChallenge.deleteMany({ where: { id: body.challengeId, caseId: id } });
    }
    // Guarded: an already-signed case's files are the issued documents and a late failure report
    // must never delete them.
    const signed = await this.prisma.caseSignature.findUnique({ where: { caseId: id }, select: { id: true } });
    if (!signed) await this.store.removeAll(id);
    return { ok: true };
  }
}
