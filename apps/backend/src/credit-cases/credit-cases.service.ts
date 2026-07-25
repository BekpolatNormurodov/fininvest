import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ScoringVerdict } from '@prisma/client';
import { addBusinessDays, caseSubmitErrors, CaseStatus, DocumentType, formatContractNumber, hasDeadline, insurancePremiumRate, INSURANCE_MAX_MONTHS, isCaseInScope, loanRuleViolations, originationPersistedValues, paymentDayFor, ProductType, ReMflContractDto, Role, scoreForCase, termBandFor, loanProductProfile, LoanProductKind, assetFinancials, type LoanProduct, type ScorableCase } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from './workflow.service';
import { caseInclude, toCaseDto, toListItem } from './case.mapper';
import {
  AffordabilityInput, BorrowerInput, CaseSectionDto, CollateralInput, CreditHistoryInput, CreditLineInput,
  DisbursementInput, EmploymentInput, TransitionDto, UpsertCaseDto,
} from './dto';
import { isRateInBounds } from './rate.util';
import { nextCounter } from './contract-counter';

const parseDate = (s?: string | null): Date | null => (s ? new Date(s) : null);

@Injectable()
export class CreditCasesService {
  private readonly log = new Logger(CreditCasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
  ) {}

  private async nextNumber(branchSymbol: string | null): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${branchSymbol ?? 'GEN'}-${year}-`;
    const count = await this.prisma.creditCase.count({ where: { number: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  /** Client lending-rate bounds from the singleton config (with defaults). */
  private async loadRates(): Promise<{ min: number; max: number }> {
    const cfg = await this.prisma.appConfig.findUnique({ where: { id: 'default' } });
    return { min: cfg?.minRate ?? 0.55, max: cfg?.maxRate ?? 0.6 };
  }

  /** Default lending rate: the product's own floor (ADM TEAM 32%, OSON …) when a product is set,
   *  otherwise the config minimum. Each of the four products carries its own rate — not a shared 55%. */
  private rateForProduct(product: LoanProduct | null | undefined, fallback: number): number {
    return product ? loanProductProfile(product).rateMinPct / 100 : fallback;
  }

  /** Server-authoritative loan-rule guard (term caps). Throws on violation. */
  private assertRules(dto: UpsertCaseDto) {
    const l = dto.creditLine;
    const errs = loanRuleViolations({
      scheduleType: l?.tranche?.scheduleType ?? null,
      trancheTermMonths: l?.tranche?.termMonths ?? null,
      lineTermMonths: l?.termMonths ?? null,
    });
    if (errs.length) throw new ForbiddenException(errs.join('; '));
  }

  /** Backfill the affordability new-loan payment from the tranche so the stored DTI matches the UI. */
  private fillDerived(dto: UpsertCaseDto) {
    const mp = dto.creditLine?.tranche?.monthlyPayment;
    if (dto.affordability && dto.affordability.newLoanPayment == null && mp != null) {
      dto.affordability.newLoanPayment = mp;
    }
  }

  private collateralCreate(c: CollateralInput): Prisma.CollateralCreateWithoutCaseInput {
    return {
      type: c.type,
      agreedValue: c.agreedValue ?? null,
      agreedValueWords: c.agreedValueWords ?? null,
      realtyKind: c.realtyKind ?? null,
      address: c.address ?? null,
      registryNo: c.registryNo ?? null,
      propertyType: c.propertyType ?? null,
      cadastreNo: c.cadastreNo ?? null,
      registrationDate: parseDate(c.registrationDate),
      landAreaM2: c.landAreaM2 ?? null,
      totalAreaM2: c.totalAreaM2 ?? null,
      usableAreaM2: c.usableAreaM2 ?? null,
      livingAreaM2: c.livingAreaM2 ?? null,
      roomNames: c.roomNames ?? null,
      roomCount: c.roomCount ?? null,
      techPassportNo: c.techPassportNo ?? null,
      techPassportDate: parseDate(c.techPassportDate),
      model: c.model ?? null,
      stateNumber: c.stateNumber ?? null,
      bodyType: c.bodyType ?? null,
      bodyNo: c.bodyNo ?? null,
      engineNo: c.engineNo ?? null,
      chassis: c.chassis ?? null,
      color: c.color ?? null,
      year: c.year ?? null,
      mileage: c.mileage ?? null,
      owners: { create: (c.owners ?? []).map((o) => ({ ...o, sharePercent: o.sharePercent ?? null })) },
    };
  }

  private creditLineNested(l: CreditLineInput, rate: number, product?: LoanProduct | null) {
    const t = l.tranche ?? null;
    const ins = l.insurance ?? null;
    // Insurance rules are server-authoritative: the policy-backed portion (amountPolis) is the loan
    // under policy, the rate is a fixed 2%/yil, and the term is capped at 2 years (24 months).
    const insured = ins?.insured ?? false;
    const insLoan = insured ? (l.amountPolis ?? ins?.loanUnderPolicy ?? null) : (ins?.loanUnderPolicy ?? null);
    // Term capped at 48 months (4 years); premium rate is derived from the term bracket (2%/4%).
    const insMonths = ins?.policyTermMonths != null ? Math.min(ins.policyTermMonths, INSURANCE_MAX_MONTHS) : null;
    const insRate = insured ? insurancePremiumRate(insMonths) : null;
    const d = originationPersistedValues({
      amountTotal: l.amountTotal ?? null,
      loanUnderPolicy: insLoan,
      insuranceRate: insRate,
      policyTermMonths: insMonths,
      trancheMonthlyPayment: t?.monthlyPayment ?? null,
      requiredInsuredAmount: l.requiredInsuredAmount ?? null,
    });
    // Asset products (AVTO/IPOTEKA) insure the asset itself — keep the operator-entered insured sum
    // and premium; the loan-risk derivation (d.*) is for cash cover only.
    const isAssetIns = product ? loanProductProfile(product).kind === LoanProductKind.ASSET : false;
    const finalInsuredSum = isAssetIns ? (ins?.insuredSum ?? null) : d.insuredSum;
    const finalPremium = isAssetIns ? (ins?.premium ?? null) : d.premium;
    return {
      lineNumber: l.lineNumber ?? null, loanType: d.loanType,
      amountAuto: l.amountAuto ?? null, amountPolis: l.amountPolis ?? null, amountTotal: l.amountTotal ?? null,
      termMonths: l.termMonths ?? null, lineDate: parseDate(l.lineDate), lineMaturity: parseDate(l.lineMaturity),
      interestRate: rate, penaltyRate: l.penaltyRate ?? 1.05, orderNumber: l.orderNumber ?? null,
      requiredCollateralAmount: l.requiredCollateralAmount ?? null, requiredInsuredAmount: l.requiredInsuredAmount ?? null,
      ...(ins ? { insurance: { create: { insured, company: ins.company ?? null, genAgreementNo: ins.genAgreementNo ?? null, genAgreementDate: parseDate(ins.genAgreementDate), policyNo: ins.policyNo ?? null, policyIssueDate: parseDate(ins.policyIssueDate), policyTermMonths: insMonths, policyExpiry: parseDate(ins.policyExpiry), loanUnderPolicy: insLoan, insuredSum: finalInsuredSum, insuranceRate: insRate, premium: finalPremium } } } : {}),
      ...(t ? { tranches: { create: [{ trancheNo: t.trancheNo ?? 1, applicationNo: t.applicationNo ?? null, applicationDate: parseDate(t.applicationDate), contractNo: t.contractNo ?? null, contractDate: parseDate(t.contractDate), principal: t.principal ?? null, termMonths: t.termMonths ?? null, maturity: parseDate(t.maturity), scheduleType: t.scheduleType ?? null, monthlyPayment: t.monthlyPayment ?? null, paymentDay: paymentDayFor(t.applicationDate), insurancePayment: t.insurancePayment ?? null }] } } : {}),
    };
  }
  private borrowerData(b: BorrowerInput) {
    return {
      fullName: b.fullName, passportSeries: b.passportSeries ?? null, passportNumber: b.passportNumber ?? null,
      pinfl: b.pinfl ?? null, birthDate: parseDate(b.birthDate), address: b.address ?? null, phone: b.phone ?? null,
      gender: b.gender ?? null, citizenship: b.citizenship ?? null, placeOfBirth: b.placeOfBirth ?? null,
      previousName: b.previousName ?? null, inn: b.inn ?? null, passportIssuer: b.passportIssuer ?? null,
      passportIssueDate: parseDate(b.passportIssueDate), passportExpiry: parseDate(b.passportExpiry),
      regAddress: b.regAddress ?? null, regLandmark: b.regLandmark ?? null, regTenure: b.regTenure ?? null,
      regMatchesActual: b.regMatchesActual ?? null, actualAddress: b.actualAddress ?? null,
      actualLandmark: b.actualLandmark ?? null, actualTenure: b.actualTenure ?? null,
      phones: b.phones ?? undefined,
      closeContacts: (b.closeContacts ?? undefined) as object | undefined,
      entrepreneurType: b.entrepreneurType ?? null, entrepreneurCertNo: b.entrepreneurCertNo ?? null,
      maritalStatus: b.maritalStatus ?? null, familySize: b.familySize ?? null,
      childrenCount: b.childrenCount ?? null, education: b.education ?? null, residenceDuration: b.residenceDuration ?? null,
      ownsHome: b.ownsHome ?? null, depositsBand: b.depositsBand ?? null,
    };
  }

  /**
   * The borrower fields to write on an UPDATE — only the ones the caller actually sent.
   *
   * `borrowerData` maps every absent field to null, which is right when creating a row and
   * destructive when patching one. A section save carries whatever the client had in memory, so
   * saving step 2 with a thin borrower object silently nulled the education, marital status,
   * tenure and deposit band entered on step 1 — and with them five scoring factors.
   *
   * `undefined` means "not sent, leave it"; an explicit `null` still clears the field, so the
   * operator can empty one deliberately.
   */
  private borrowerUpdate(b: BorrowerInput) {
    const sent = b as unknown as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(this.borrowerData(b)).filter(([k]) => sent[k] !== undefined),
    );
  }

  private employmentData(e: EmploymentInput) {
    return { employer: e.employer ?? null, employerAddress: e.employerAddress ?? null, sector: e.sector ?? null, sectorRiskCode: e.sectorRiskCode ?? null, position: e.position ?? null, employedSince: e.employedSince ?? null, experienceBand: e.experienceBand ?? null };
  }
  private affordabilityData(a: AffordabilityInput) {
    return { mainActivityIncome: a.mainActivityIncome ?? null, secondaryIncome: a.secondaryIncome ?? null, familyIncome: a.familyIncome ?? null, otherIncome: a.otherIncome ?? null, utilitiesExpense: a.utilitiesExpense ?? null, familyExpense: a.familyExpense ?? null, otherExpense: a.otherExpense ?? null, existingCreditBurden: a.existingCreditBurden ?? null, newLoanPayment: a.newLoanPayment ?? null };
  }
  private creditHistoryData(h: CreditHistoryInput) {
    return { repaidLoansCount: h.repaidLoansCount ?? null, activeLoansCount: h.activeLoansCount ?? null, overdueSubstandardFlag: h.overdueSubstandardFlag ?? null, otherObligations: h.otherObligations ?? null, loansOver5MFlag: h.loansOver5MFlag ?? null, priorMfiPawnshopFlag: h.priorMfiPawnshopFlag ?? null, totalOutstandingDebt: h.totalOutstandingDebt ?? null, avgMonthlyPaymentExisting: h.avgMonthlyPaymentExisting ?? null, committeeProtocolRef: h.committeeProtocolRef ?? null, committeeDecisionDate: parseDate(h.committeeDecisionDate) };
  }

  async createCase(user: RequestUser, dto: UpsertCaseDto) {
    const branch = user.branchId
      ? await this.prisma.branch.findUnique({ where: { id: user.branchId } })
      : null;
    const number = await this.nextNumber(branch?.symbol ?? null);
    const productType = dto.collaterals?.[0]?.type ?? ProductType.REAL_ESTATE;
    this.assertRules(dto);
    this.fillDerived(dto);
    const { min } = await this.loadRates();
    const amount = dto.creditLine?.amountTotal ?? dto.amount ?? null;
    const termForBand = dto.creditLine?.termMonths ?? dto.termMonths ?? null;
    const fin = assetFinancials(dto.product ?? null, amount, dto.collaterals?.[0]?.agreedValue ?? null);

    const created = await this.prisma.creditCase.create({
      data: {
        number,
        productType,
        product: dto.product ?? null,
        sellerId: dto.sellerId ?? null,
        termBand: termForBand ? termBandFor(termForBand) : null,
        ltvPct: fin.ltvPct,
        downPaymentPct: fin.downPaymentPct,
        status: CaseStatus.DRAFT,
        amount,
        termMonths: dto.termMonths ?? null,
        branchId: user.branchId,
        createdById: user.id,
        borrower: { create: this.borrowerData(dto.borrower) },
        guarantors: { create: (dto.guarantors ?? []).map((g) => ({ ...g })) },
        collaterals: { create: (dto.collaterals ?? []).map((c) => this.collateralCreate(c)) },
        ...(dto.employment ? { employment: { create: this.employmentData(dto.employment) } } : {}),
        ...(dto.affordability ? { affordability: { create: this.affordabilityData(dto.affordability) } } : {}),
        ...(dto.creditHistory ? { creditHistory: { create: this.creditHistoryData(dto.creditHistory) } } : {}),
        ...(dto.creditLine ? { creditLine: { create: this.creditLineNested(dto.creditLine, this.rateForProduct(dto.product ?? null, min), dto.product ?? null) } } : {}),
      },
      include: caseInclude,
    });
    await this.audit.caseCreate(user, created.id);
    await this.persistScoring(created.id);
    return toCaseDto(created);
  }

  async updateCase(id: string, user: RequestUser, dto: UpsertCaseDto) {
    const res = await this.applyUpdate(id, user, dto);
    await this.audit.caseUpdate(user, id);
    return res;
  }

  /** Archive (soft-delete) a DRAFT case. An operator may archive only their own draft; admin any
   *  draft. Non-draft cases (already in the workflow) are never deletable. The case is not removed —
   *  it moves to the Arxiv view and can be restored. A reason is required and audited. */
  async deleteCase(id: string, user: RequestUser, reason: string): Promise<{ id: string }> {
    const existing = await this.prisma.creditCase.findUnique({
      where: { id },
      select: { status: true, createdById: true, number: true, deletedAt: true },
    });
    if (!existing) throw new NotFoundException('Ariza topilmadi');
    if (existing.deletedAt) throw new ForbiddenException('Ariza allaqachon o‘chirilgan');
    if (existing.status !== CaseStatus.DRAFT) {
      throw new ForbiddenException('Faqat qoralama holatidagi arizani o‘chirish mumkin');
    }
    if (user.role === Role.OPERATOR && existing.createdById !== user.id) {
      throw new ForbiddenException('Bu ariza sizga tegishli emas');
    }
    await this.prisma.creditCase.update({
      where: { id },
      data: { deletedAt: new Date(), deletedReason: reason, deletedById: user.id },
    });
    await this.audit.caseDelete(user, id, existing.number, reason);
    return { id };
  }

  /** Restore an archived draft back to the active list. Operator restores their own; admin any.
   *  Clears the soft-delete fields; updatedAt refreshes to now so it re-enters dated today. */
  async restoreCase(id: string, user: RequestUser): Promise<{ id: string }> {
    const existing = await this.prisma.creditCase.findUnique({
      where: { id },
      select: { createdById: true, number: true, deletedAt: true },
    });
    if (!existing) throw new NotFoundException('Ariza topilmadi');
    if (!existing.deletedAt) throw new ForbiddenException('Ariza o‘chirilmagan');
    if (user.role === Role.OPERATOR && existing.createdById !== user.id) {
      throw new ForbiddenException('Bu ariza sizga tegishli emas');
    }
    await this.prisma.creditCase.update({
      where: { id },
      data: { deletedAt: null, deletedReason: null, deletedById: null },
    });
    await this.audit.caseRestore(user, id, existing.number);
    return { id };
  }

  /** Archived (soft-deleted) cases, role-scoped, optionally filtered by a search term. */
  async listArchived(user: RequestUser, q = ''): Promise<ReturnType<typeof toListItem>[]> {
    const term = q.trim();
    const scope: Prisma.CreditCaseWhereInput =
      user.role === Role.OPERATOR ? { createdById: user.id } : {}; // admin sees all archived
    const cases = await this.prisma.creditCase.findMany({
      where: {
        AND: [
          scope,
          { deletedAt: { not: null } },
          term.length >= 2
            ? {
                OR: [
                  { number: { contains: term } },
                  { borrower: { fullName: { contains: term } } },
                  { borrower: { passportNumber: { contains: term } } },
                  { borrower: { pinfl: { contains: term } } },
                  { createdBy: { fullName: { contains: term } } },
                ],
              }
            : {},
        ],
      },
      include: { branch: true, borrower: true, createdBy: true },
      orderBy: { deletedAt: 'desc' },
    });
    return cases.map(toListItem);
  }

  private async applyUpdate(id: string, user: RequestUser, dto: UpsertCaseDto) {
    const existing = await this.prisma.creditCase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ariza topilmadi');
    if (existing.status !== CaseStatus.DRAFT) {
      throw new ForbiddenException('Faqat qoralama holatidagi arizani tahrirlash mumkin');
    }
    if (user.role === Role.OPERATOR && existing.createdById !== user.id) {
      throw new ForbiddenException('Bu ariza sizga tegishli emas');
    }
    this.assertRules(dto);
    this.fillDerived(dto);

    const { min } = await this.loadRates();
    // Preserve a moderator-raised rate across a later DRAFT re-save (operator never sets the rate).
    // A never-rated case falls back to the product's own floor, not the shared config minimum.
    const existingLine = await this.prisma.creditLine.findUnique({ where: { caseId: id }, select: { interestRate: true } });
    const lineRate = existingLine?.interestRate != null
      ? Number(existingLine.interestRate)
      : this.rateForProduct((dto.product ?? existing.product) as LoanProduct | null, min);

    const newTermForBand = dto.creditLine?.termMonths ?? dto.termMonths ?? existing.termMonths;
    // Recompute asset financials from the effective loan + purchased-asset value (dto wins, else saved).
    const effProduct = (dto.product ?? existing.product) as LoanProduct | null;
    const effAmount = dto.creditLine?.amountTotal ?? (existing.amount != null ? Number(existing.amount) : null);
    let effAssetVal = dto.collaterals?.[0]?.agreedValue ?? null;
    if (effAssetVal == null && effProduct && loanProductProfile(effProduct).kind === LoanProductKind.ASSET) {
      const col = await this.prisma.collateral.findFirst({ where: { caseId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { agreedValue: true } });
      effAssetVal = col?.agreedValue != null ? Number(col.agreedValue) : null;
    }
    const finU = assetFinancials(effProduct, effAmount, effAssetVal);
    await this.prisma.$transaction([
      this.prisma.creditCase.update({
        where: { id },
        data: {
          // amount mirrors the credit line exactly (and stays clearable); only touched when that section is saved.
          ...(dto.creditLine ? { amount: dto.creditLine.amountTotal ?? null } : {}),
          termMonths: dto.termMonths ?? existing.termMonths,
          // fin-invest: keep the product when a section save omits it; re-derive the band from the term.
          ...(dto.product !== undefined ? { product: dto.product } : {}),
          ...(dto.sellerId !== undefined ? { sellerId: dto.sellerId } : {}),
          termBand: newTermForBand ? termBandFor(newTermForBand) : existing.termBand,
          ltvPct: finU.ltvPct,
          downPaymentPct: finU.downPaymentPct,
          ...(dto.collaterals !== undefined ? { productType: dto.collaterals[0]?.type ?? existing.productType } : {}),
        },
      }),
      /*
        Guarded: a section save that does not carry the borrower used to crash here with a 500
        instead of leaving the borrower alone. The type says it is always present, which is true of
        the wizard but not of every caller — and a missing optional section must be a no-op, never
        an internal error.
      */
      ...(dto.borrower
        ? [this.prisma.borrower.upsert({
            where: { caseId: id },
            create: { caseId: id, ...this.borrowerData(dto.borrower) },
            update: this.borrowerUpdate(dto.borrower),
          })]
        : []),
      // Only churn guarantors/collaterals when that section is actually being saved
      // (so a later-step autosave can't wipe rows or reset collateral IDs — review #3).
      ...(dto.guarantors !== undefined ? [
        this.prisma.guarantor.deleteMany({ where: { caseId: id } }),
        ...(dto.guarantors ?? []).map((g) => this.prisma.guarantor.create({ data: { caseId: id, ...g } })),
      ] : []),
      ...(dto.collaterals !== undefined ? [
        this.prisma.collateral.deleteMany({ where: { caseId: id } }),
        ...dto.collaterals.map((c) => this.prisma.collateral.create({ data: { caseId: id, ...this.collateralCreate(c) } })),
      ] : []),
      ...(dto.employment ? [this.prisma.employment.upsert({ where: { caseId: id }, create: { caseId: id, ...this.employmentData(dto.employment) }, update: this.employmentData(dto.employment) })] : []),
      ...(dto.affordability ? [this.prisma.affordability.upsert({ where: { caseId: id }, create: { caseId: id, ...this.affordabilityData(dto.affordability) }, update: this.affordabilityData(dto.affordability) })] : []),
      ...(dto.creditHistory ? [this.prisma.creditHistory.upsert({ where: { caseId: id }, create: { caseId: id, ...this.creditHistoryData(dto.creditHistory) }, update: this.creditHistoryData(dto.creditHistory) })] : []),
      ...(dto.creditLine ? [this.prisma.creditLine.deleteMany({ where: { caseId: id } }), this.prisma.creditLine.create({ data: { caseId: id, ...this.creditLineNested(dto.creditLine, lineRate, effProduct) } })] : []),
    ]);

    await this.persistScoring(id);
    return this.getOne(id);
  }


  /**
   * Recompute the score and store it, factor by factor.
   *
   * Written on every edit rather than left to be derived on read, so the twenty rows in the
   * database always describe the case as it stands. A stored result that lags the data would be
   * worse than none: the report prefers the stored one, and a stale row would print a score for an
   * application that no longer exists.
   *
   * Never fails the save. A score is a reading of the case, not part of it — if this cannot be
   * written the edit still stands, and the next edit writes it. Logged, not swallowed silently.
   */
  private async persistScoring(id: string): Promise<void> {
    try {
      const full = await this.getOne(id);
      const r = scoreForCase(full as unknown as ScorableCase);
      const rows = r.factors.map((f) => ({
        factorNo: f.no, name: f.label, points: f.points, maxPoints: f.max,
      }));
      const data = {
        totalScore: r.total,
        maxScore: r.max,
        verdict: r.verdict as ScoringVerdict,
        age: r.ratios.age,
        monthlyTranches: r.ratios.tranche,
        monthlyIncome: r.ratios.income,
        monthlyExpenses: r.ratios.expenses,
        surplus: r.ratios.surplus,
        netAfterDebt: r.ratios.incomeMinusTranche,
        computedAt: new Date(),
      };
      await this.prisma.$transaction(async (tx) => {
        // Replace the factor rows wholesale — they are a snapshot, not a log, and a partial
        // update would leave rows from a previous shape of the case behind.
        const prev = await tx.scoringResult.findUnique({ where: { caseId: id }, select: { id: true } });
        if (prev) await tx.scoringFactor.deleteMany({ where: { resultId: prev.id } });
        await tx.scoringResult.upsert({
          where: { caseId: id },
          create: { caseId: id, ...data, factors: { create: rows } },
          update: { ...data, factors: { create: rows } },
        });
      });
    } catch (err) {
      this.log.error(`scoring not stored for case ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Everyone with access to this case's chat, ordered operator -> moderator -> director -> admin. */
  async participants(id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id }, select: { branchId: true, createdById: true } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    const or: Prisma.UserWhereInput[] = [{ id: c.createdById }, { role: Role.DIRECTOR }, { role: Role.ADMIN }];
    if (c.branchId) or.push({ role: Role.MODERATOR, moderatedBranches: { some: { id: c.branchId } } });
    const users = await this.prisma.user.findMany({
      where: { isActive: true, OR: or },
      select: { id: true, fullName: true, role: true },
    });
    const rank: Record<string, number> = { OPERATOR: 0, MODERATOR: 1, DIRECTOR: 2, ADMIN: 3 };
    return users.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.fullName.localeCompare(b.fullName));
  }

  async list(user: RequestUser, mineOnly = false): Promise<ReturnType<typeof toListItem>[]> {
    const where: Prisma.CreditCaseWhereInput = { deletedAt: null }; // archived cases live in the Arxiv view
    if (user.role === Role.OPERATOR) {
      where.createdById = user.id;
    } else if (user.role === Role.MODERATOR) {
      where.status = mineOnly
        ? CaseStatus.MODERATION
        : { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] };
      // A moderator only sees cases from the branches assigned to them.
      const assigned = await this.prisma.branch.findMany({
        where: { moderators: { some: { id: user.id } } },
        select: { id: true },
      });
      where.branchId = { in: assigned.map((b) => b.id) };
    } else if (user.role === Role.DIRECTOR) {
      // Director oversees the whole active pipeline (may cancel/reopen any step).
      where.status = mineOnly
        ? CaseStatus.DIRECTOR_REVIEW
        : { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] };
    }
    // ADMIN has no workflow step/inbox (Spec B) — it's a superset viewer with no status narrowing,
    // same with or without `mineOnly` (there is nothing to scope an admin "inbox" down to).

    const cases = await this.prisma.creditCase.findMany({
      where,
      include: { branch: true, borrower: true, createdBy: true },
      orderBy: { updatedAt: 'desc' },
    });
    return cases.map(toListItem);
  }

  /** Role-scoped visibility base (no mineOnly status narrowing). */
  private async scopeWhere(user: RequestUser): Promise<Prisma.CreditCaseWhereInput> {
    if (user.role === Role.OPERATOR) return { createdById: user.id };
    if (user.role === Role.MODERATOR) {
      const assigned = await this.prisma.branch.findMany({
        where: { moderators: { some: { id: user.id } } },
        select: { id: true },
      });
      return {
        branchId: { in: assigned.map((b) => b.id) },
        status: { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] },
      };
    }
    if (user.role === Role.DIRECTOR) {
      return { status: { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] } };
    }
    return {}; // ADMIN — all
  }

  /** Global search across number, borrower, guarantor, operator and branch. */
  async search(user: RequestUser, q: string): Promise<ReturnType<typeof toListItem>[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const scope = await this.scopeWhere(user);
    const cases = await this.prisma.creditCase.findMany({
      where: {
        AND: [
          scope,
          { deletedAt: null },
          {
            OR: [
              { number: { contains: term } },
              { borrower: { fullName: { contains: term } } },
              { borrower: { passportNumber: { contains: term } } },
              { borrower: { pinfl: { contains: term } } },
              { guarantors: { some: { fullName: { contains: term } } } },
              { createdBy: { fullName: { contains: term } } },
              { branch: { name: { contains: term } } },
              { branch: { symbol: { contains: term } } },
            ],
          },
        ],
      },
      include: { branch: true, borrower: true, createdBy: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });
    return cases.map(toListItem);
  }

  async getOne(id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id }, include: caseInclude });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    return toCaseDto(c);
  }

  /** Deadline/timer fields to write when a case enters `to` (any transition clears a pause). */
  private async stepTimerData(to: CaseStatus): Promise<Prisma.CreditCaseUpdateInput> {
    const now = new Date();
    if (!hasDeadline(to)) {
      // Terminal / draft — no timer.
      return { stepStartedAt: now, stepDeadlineAt: null, overdueNotified: false, pausedAt: null };
    }
    const setting = await this.prisma.stepSetting.findUnique({ where: { step: to } });
    const enabled = setting?.enabled ?? true;
    const days = setting?.businessDays ?? 2;
    if (!enabled) {
      // Step timer switched off by admin — no deadline.
      return { stepStartedAt: now, stepDeadlineAt: null, overdueNotified: false, pausedAt: null };
    }
    return { stepStartedAt: now, stepDeadlineAt: addBusinessDays(now, days), overdueNotified: false, pausedAt: null };
  }

  /**
   * Put an active case on hold — suspends its SLA timer (moderator/director/admin).
   * `days` is the business-day pause window chosen by the user, clamped to the admin
   * maximum (maxPauseDays). The case auto-resumes at `pauseUntil` if not resumed sooner.
   */
  async pause(id: string, user: RequestUser, days?: number) {
    const c = await this.prisma.creditCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    if (!hasDeadline(c.status)) throw new ForbiddenException('Faqat aktiv bosqichdagi arizani pauzaga qo‘yish mumkin');
    if (c.pausedAt) return this.getOne(id);
    const cfg = await this.prisma.appConfig.findUnique({ where: { id: 'default' } });
    const max = Math.max(1, cfg?.maxPauseDays ?? 5);
    const window = Math.max(1, Math.min(max, Math.round(days ?? max)));
    const now = new Date();
    await this.prisma.creditCase.update({
      where: { id },
      data: { pausedAt: now, pauseUntil: addBusinessDays(now, window) },
    });
    await this.audit.pause(user, id);
    return this.getOne(id);
  }

  /** Resume a paused case — shifts its deadline forward by the paused time (capped at the pause window). */
  async resume(id: string, user: RequestUser) {
    const c = await this.prisma.creditCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    if (!c.pausedAt) return this.getOne(id);
    const cfg = await this.prisma.appConfig.findUnique({ where: { id: 'default' } });
    // Cap the shift at the chosen window (pauseUntil − pausedAt) or, for legacy pauses
    // without a window, the admin maximum in calendar days.
    const capMs = c.pauseUntil
      ? c.pauseUntil.getTime() - c.pausedAt.getTime()
      : (cfg?.maxPauseDays ?? 5) * 24 * 60 * 60 * 1000;
    const ext = Math.min(Date.now() - c.pausedAt.getTime(), capMs);
    const newDeadline = c.stepDeadlineAt ? new Date(c.stepDeadlineAt.getTime() + ext) : null;
    await this.prisma.creditCase.update({
      where: { id },
      data: { pausedAt: null, pauseUntil: null, stepDeadlineAt: newDeadline, overdueNotified: false },
    });
    await this.audit.resume(user, id);
    return this.getOne(id);
  }

  /** Qayta MFL: find existing clients by name / PINFL / phone / passport number. Returns ALL of
   *  their cases (not only numbered ones) with status/date/amount so the operator can pick one.
   *  If the chosen case has a contract number, its MFL identifier (yearly+branch) is reused; if
   *  not, the Qayta MFL draft gets a fresh number at submit. */
  async searchReMfl(term: string): Promise<ReMflContractDto[]> {
    const t = term.trim();
    // An empty term lists the most recent cases (the frontend gates min length, but stay robust).
    const cases = await this.prisma.creditCase.findMany({
      where: {
        deletedAt: null, // archived clients are not offered for a repeat MFL
        ...(t
          ? {
              borrower: {
                OR: [
                  { fullName: { contains: t } },
                  { pinfl: { contains: t } },
                  { phone: { contains: t } },
                  { passportNumber: { contains: t } },
                ],
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { borrower: { select: { fullName: true } } },
    });
    return cases.map((c) => ({
      caseId: c.id,
      contractNumber: c.contractNumber ?? null,
      contractYearlyNo: c.contractYearlyNo ?? null,
      contractBranchSym: c.contractBranchSym ?? null,
      status: c.status as CaseStatus,
      date: c.createdAt.toISOString(),
      amount: c.amount != null ? Number(c.amount) : null,
      fullName: c.borrower?.fullName ?? '—',
    }));
  }

  /** Qayta MFL: create a new DRAFT for a repeat client, copying only their identity from the chosen
   *  source contract. Financials are entered fresh; yearly+branch are reused from the source at submit. */
  async createReMfl(user: RequestUser, sourceCaseId: string) {
    const src = await this.prisma.creditCase.findUnique({
      where: { id: sourceCaseId },
      include: { borrower: true },
    });
    if (!src || !src.borrower) throw new NotFoundException('Manba shartnoma topilmadi');
    const b = src.borrower;
    const branchSym = user.branchId
      ? (await this.prisma.branch.findUnique({ where: { id: user.branchId }, select: { symbol: true } }))?.symbol ?? null
      : null;
    const number = await this.nextNumber(branchSym);
    const created = await this.prisma.creditCase.create({
      data: {
        number,
        productType: src.productType,
        status: CaseStatus.DRAFT,
        branchId: user.branchId,
        createdById: user.id,
        isReMfl: true,
        reMflSourceId: src.id,
        borrower: {
          create: {
            fullName: b.fullName, passportSeries: b.passportSeries, passportNumber: b.passportNumber,
            pinfl: b.pinfl, birthDate: b.birthDate, address: b.address, phone: b.phone,
            gender: b.gender, citizenship: b.citizenship, placeOfBirth: b.placeOfBirth,
            previousName: b.previousName, inn: b.inn, passportIssuer: b.passportIssuer,
            passportIssueDate: b.passportIssueDate, passportExpiry: b.passportExpiry,
            regAddress: b.regAddress, regLandmark: b.regLandmark, regTenure: b.regTenure,
            regMatchesActual: b.regMatchesActual, actualAddress: b.actualAddress,
            actualLandmark: b.actualLandmark, actualTenure: b.actualTenure,
            phones: (b.phones ?? undefined) as object | undefined,
            closeContacts: (b.closeContacts ?? undefined) as object | undefined,
            maritalStatus: b.maritalStatus, familySize: b.familySize, childrenCount: b.childrenCount,
            education: b.education, residenceDuration: b.residenceDuration, ownsHome: b.ownsHome,
            depositsBand: b.depositsBand, entrepreneurType: b.entrepreneurType, entrepreneurCertNo: b.entrepreneurCertNo,
          },
        },
      },
      include: caseInclude,
    });
    await this.audit.caseCreate(user, created.id);
    return toCaseDto(created);
  }

  async transition(id: string, user: RequestUser, dto: TransitionDto) {
    const c = await this.prisma.creditCase.findUnique({
      where: { id },
      include: {
        documents: true,
        collaterals: { select: { id: true } },
        creditLine: { include: { tranches: true } },
        branch: { select: { symbol: true } },
        reMflSource: { select: { contractYearlyNo: true, contractBranchSym: true } },
      },
    });
    if (!c) throw new NotFoundException('Ariza topilmadi');

    const rule = this.workflow.resolve({
      currentStatus: c.status,
      role: user.role,
      decision: dto.decision,
      documentTypes: c.documents.map((d) => d.type as DocumentType),
    });

    // Submit-time (DRAFT → MODERATION) server-authoritative gate: FULL required-field validation
    // (single source of truth shared with the wizard) + the per-collateral media cap, so a
    // half-filled draft can never reach the moderator. Runs only for the actual submit, so other
    // DRAFT decisions get the correct workflow error.
    if (c.status === CaseStatus.DRAFT && rule.to === CaseStatus.MODERATION) {
      const full = await this.getOne(id);
      const problems = caseSubmitErrors(full);
      // 400 (not 403) so the client surfaces the field list — getErrorMessage returns a generic
      // "Ruxsat yo'q" for any 403, but shows the server message body for a 400.
      if (problems.length) throw new BadRequestException(problems.join('; '));

      // Photos/videos are optional (0..10 per collateral) — only the upper bound is enforced.
      const mediaByCol = new Map<string, number>();
      for (const d of c.documents) {
        if (!d.collateralId) continue;
        const m = d.mimeType ?? '';
        if (m.startsWith('image/') || m.startsWith('video/') || d.type === DocumentType.COLLATERAL_PHOTO) {
          mediaByCol.set(d.collateralId, (mediaByCol.get(d.collateralId) ?? 0) + 1);
        }
      }
      if (c.collaterals.some((col) => (mediaByCol.get(col.id) ?? 0) > 10)) {
        throw new BadRequestException('Har bir garovga ko‘pi bilan 10 ta rasm yoki video biriktiriladi');
      }

      // Assign the company-wide contract number exactly once, at submit. New client: consume a new
      // global + yearly. Qayta MFL: consume a new global, reuse the source's yearly + branch.
      if (!c.contractNumber) {
        await this.prisma.$transaction(async (tx) => {
          const global = await nextCounter(tx, 'global');
          let yearly: number;
          let branchSym: string;
          if (c.isReMfl && c.reMflSource?.contractYearlyNo != null) {
            yearly = c.reMflSource.contractYearlyNo;
            branchSym = c.reMflSource.contractBranchSym ?? c.branch?.symbol ?? 'GEN';
          } else {
            yearly = await nextCounter(tx, String(new Date().getFullYear()));
            branchSym = c.branch?.symbol ?? 'GEN';
          }
          await tx.creditCase.update({
            where: { id },
            data: {
              contractGlobalNo: global,
              contractYearlyNo: yearly,
              contractBranchSym: branchSym,
              contractNumber: formatContractNumber(global, yearly, branchSym),
            },
          });
        });
      }
    }

    const timer = await this.stepTimerData(rule.to);

    await this.prisma.$transaction([
      this.prisma.creditCase.update({ where: { id }, data: { status: rule.to, ...timer } }),
      this.prisma.workflowEvent.create({
        data: {
          caseId: id,
          fromStatus: c.status,
          toStatus: rule.to,
          decision: dto.decision,
          actorId: user.id,
          role: user.role,
          comment: dto.comment ?? null,
        },
      }),
    ]);

    await this.audit.transition(user, id, c.status, rule.to);
    return this.getOne(id);
  }

  async setKatmPrice(id: string, user: RequestUser, katmPrice: number) {
    const before = await this.prisma.creditCase.findUnique({ where: { id }, select: { katmPrice: true } });
    await this.prisma.creditCase.update({ where: { id }, data: { katmPrice } });
    await this.audit.katmPrice(user, id, before?.katmPrice != null ? Number(before.katmPrice) : null, katmPrice);
    return this.getOne(id);
  }

  /** Persist a single wizard step (autosave). Writes only the named section. */
  async saveSection(id: string, user: RequestUser, dto: CaseSectionDto) {
    const base = dto.data;
    const masked: UpsertCaseDto = {
      amount: base.amount, termMonths: base.termMonths,
      borrower: base.borrower,
      guarantors: dto.section === 'borrower' ? base.guarantors : undefined,
      collaterals: dto.section === 'creditLine' ? base.collaterals : undefined,
      employment: dto.section === 'employment' ? base.employment : undefined,
      affordability: dto.section === 'affordability' ? base.affordability : undefined,
      creditLine: dto.section === 'creditLine' ? base.creditLine : undefined,
      creditHistory: dto.section === 'creditHistory' ? base.creditHistory : undefined,
    };
    const res = await this.applyUpdate(id, user, masked);
    await this.audit.sectionSave(user, id, dto.section);
    return res;
  }

  /** Moderator/admin raise the per-case lending rate within the admin [min,max] bounds (MODERATION only). */
  async setRate(id: string, user: RequestUser, interestRate: number, reason: string) {
    if (user.role !== Role.MODERATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Foizni faqat moderator yoki admin o‘zgartiradi');
    }
    const c = await this.prisma.creditCase.findUnique({ where: { id }, include: { creditLine: true } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    if (c.status !== CaseStatus.MODERATION) throw new ForbiddenException('Faqat moderatsiya bosqichida foizni o‘zgartirish mumkin');
    // A moderator may only adjust cases in their assigned branches (same scope as list()).
    if (user.role === Role.MODERATOR) {
      const assigned = await this.prisma.branch.findMany({ where: { moderators: { some: { id: user.id } } }, select: { id: true } });
      if (!isCaseInScope(assigned.map((b) => b.id), c.branchId)) {
        throw new ForbiddenException('Bu ariza sizning filialingizga tegishli emas');
      }
    }
    if (!c.creditLine) throw new NotFoundException('Kredit liniyasi to‘ldirilmagan');
    const { min, max } = await this.loadRates();
    if (!isRateInBounds(interestRate, min, max)) {
      throw new ForbiddenException(`Foiz ${Math.round(min * 100)}% va ${Math.round(max * 100)}% oralig‘ida bo‘lishi kerak`);
    }
    const oldRate = c.creditLine.interestRate != null ? Number(c.creditLine.interestRate) : null;
    await this.prisma.creditLine.update({ where: { caseId: id }, data: { interestRate } });
    await this.audit.rateChange(user, id, oldRate, interestRate, reason);
    return this.getOne(id);
  }

  /**
   * Director sets the loan split: the property-backed (avto) vs insurance-backed (polis) portions of
   * the requested amount. Recomputes the total, loan type, and — since amountPolis IS the loan under
   * policy — the insured sum (×1.3) and premium (2%/yil, ≤2 yil). Only in the director's review stage.
   */
  async setSplit(id: string, user: RequestUser, amountAuto: number, amountPolis: number, reason?: string) {
    if (user.role !== Role.DIRECTOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Summa taqsimotini faqat rahbar yoki admin belgilaydi');
    }
    const c = await this.prisma.creditCase.findUnique({ where: { id }, include: { creditLine: { include: { insurance: true } } } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    if (c.status !== CaseStatus.DIRECTOR_REVIEW) throw new ForbiddenException('Faqat direktor ko‘rigida taqsimotni belgilash mumkin');
    if (!c.creditLine) throw new NotFoundException('Kredit liniyasi to‘ldirilmagan');
    const ins = c.creditLine.insurance;
    const insured = ins?.insured ?? false;
    const amountTotal = (amountAuto || 0) + (amountPolis || 0) || null;
    const insMonths = ins?.policyTermMonths != null ? Math.min(Number(ins.policyTermMonths), INSURANCE_MAX_MONTHS) : null;
    const insLoan = insured ? amountPolis : (ins?.loanUnderPolicy != null ? Number(ins.loanUnderPolicy) : null);
    const insRate = insured ? insurancePremiumRate(insMonths) : null;
    const d = originationPersistedValues({ amountTotal, loanUnderPolicy: insLoan, insuranceRate: insRate, policyTermMonths: insMonths, requiredInsuredAmount: c.creditLine.requiredInsuredAmount != null ? Number(c.creditLine.requiredInsuredAmount) : null });
    const old = { amountAuto: Number(c.creditLine.amountAuto ?? 0), amountPolis: Number(c.creditLine.amountPolis ?? 0) };
    await this.prisma.creditLine.update({
      where: { caseId: id },
      data: {
        amountAuto, amountPolis, amountTotal, loanType: d.loanType,
        ...(ins ? { insurance: { update: { loanUnderPolicy: insLoan, insuredSum: d.insuredSum, premium: d.premium, policyTermMonths: insMonths, insuranceRate: insRate } } } : {}),
      },
    });
    // Keep the case-level amount (used by lists/stats/documents) in sync with the new total.
    await this.prisma.creditCase.update({ where: { id }, data: { amount: amountTotal } });
    await this.audit.splitChange(user, id, old, { amountAuto, amountPolis }, reason);
    return this.getOne(id);
  }

  /**
   * Capture beneficiary bank requisites for the disbursement application ("Пул ўтказиш аризаси").
   * Any role that can see the case may record/update these — they're plain requisites, not a
   * workflow decision, so no status gate or extra role check beyond the controller's guard.
   */
  async saveDisbursement(id: string, user: RequestUser, dto: DisbursementInput) {
    const c = await this.prisma.creditCase.findUnique({
      where: { id },
      select: { id: true, status: true, signature: { select: { id: true } } },
    });
    if (!c) throw new NotFoundException('Ariza topilmadi');

    /*
      Locked once the director has signed.

      Signing freezes «Пул ўтказиш аризаси» and «Мablag' taqsimoti» to disk, and the director's key
      covers those exact bytes. Letting the requisites change afterwards would leave the issued
      document naming one account and the database another — with nothing on either to say which
      the money should go to. The account holder may legitimately be someone other than the
      borrower, which is precisely why the frozen document has to stay the record.
    */
    const locked = c.signature
      || c.status === CaseStatus.FINALIZED
      || c.status === CaseStatus.REJECTED
      || c.status === CaseStatus.CANCELLED;
    if (locked) {
      throw new ForbiddenException(
        'Ariza yakunlangan — pul o‘tkazish rekvizitlarini o‘zgartirib bo‘lmaydi',
      );
    }

    const data = {
      holderName: dto.holderName ?? null,
      cardNumber: dto.cardNumber ?? null,
      accountNumber: dto.accountNumber ?? null,
      bankMfo: dto.bankMfo ?? null,
      holderInn: dto.holderInn ?? null,
      bankName: dto.bankName ?? null,
    };
    await this.prisma.disbursementDetail.upsert({ where: { caseId: id }, create: { caseId: id, ...data }, update: data });
    return this.getOne(id);
  }
}
