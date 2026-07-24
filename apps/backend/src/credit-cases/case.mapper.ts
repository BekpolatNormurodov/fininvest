import { Prisma } from '@prisma/client';
import { CloseContactDto, CollateralDto, CreditCaseDto, CreditCaseListItem } from '@credit-core/shared';

export const caseInclude = {
  branch: true,
  createdBy: true,
  borrower: true,
  guarantors: { orderBy: { id: 'asc' } },
  // `id` breaks the tie — collaterals are created in one transaction and can share a timestamp.
  collaterals: { include: { owners: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  employment: true,
  affordability: true,
  creditHistory: true,
  creditLine: { include: { insurance: true, tranches: { orderBy: { trancheNo: 'asc' } } } },
  disbursement: true,
  seller: true,
  documents: { include: { uploadedBy: true }, orderBy: { createdAt: 'asc' } },
  events: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CreditCaseInclude;

type CaseWithRelations = Prisma.CreditCaseGetPayload<{ include: typeof caseInclude }>;
type CollateralRow = CaseWithRelations['collaterals'][number];

const num = (d: Prisma.Decimal | null): number | null => (d == null ? null : Number(d));
const iso = (d: Date | null): string | null => (d == null ? null : d.toISOString());

function toCollateral(c: CollateralRow): CollateralDto {
  return {
    id: c.id,
    type: c.type,
    agreedValue: num(c.agreedValue),
    agreedValueWords: c.agreedValueWords,
    realtyKind: (c.realtyKind as 'HOUSE' | 'APARTMENT' | null) ?? null,
    address: c.address,
    registryNo: c.registryNo,
    propertyType: c.propertyType,
    cadastreNo: c.cadastreNo,
    registrationDate: iso(c.registrationDate),
    landAreaM2: c.landAreaM2,
    totalAreaM2: c.totalAreaM2,
    usableAreaM2: c.usableAreaM2,
    livingAreaM2: c.livingAreaM2,
    roomNames: c.roomNames,
    roomCount: c.roomCount,
    techPassportNo: c.techPassportNo,
    techPassportDate: iso(c.techPassportDate),
    model: c.model,
    stateNumber: c.stateNumber,
    bodyType: c.bodyType,
    bodyNo: c.bodyNo,
    engineNo: c.engineNo,
    chassis: c.chassis,
    color: c.color,
    year: c.year,
    mileage: c.mileage,
    owners: c.owners.map((o) => ({
      id: o.id,
      fullName: o.fullName,
      passportSeries: o.passportSeries,
      passportNumber: o.passportNumber,
      pinfl: o.pinfl,
      sharePercent: o.sharePercent,
    })),
  };
}

const toEmployment = (e: CaseWithRelations['employment']) =>
  e ? { employer: e.employer, employerAddress: e.employerAddress, sector: e.sector, sectorRiskCode: e.sectorRiskCode, position: e.position, employedSince: e.employedSince, experienceBand: e.experienceBand } : null;

const toAffordability = (a: CaseWithRelations['affordability']) =>
  a ? { mainActivityIncome: num(a.mainActivityIncome), secondaryIncome: num(a.secondaryIncome), familyIncome: num(a.familyIncome), otherIncome: num(a.otherIncome), utilitiesExpense: num(a.utilitiesExpense), familyExpense: num(a.familyExpense), otherExpense: num(a.otherExpense), existingCreditBurden: num(a.existingCreditBurden), newLoanPayment: num(a.newLoanPayment) } : null;

const toCreditHistory = (h: CaseWithRelations['creditHistory']) =>
  h ? { repaidLoansCount: h.repaidLoansCount, activeLoansCount: h.activeLoansCount, overdueSubstandardFlag: h.overdueSubstandardFlag, otherObligations: h.otherObligations, loansOver5MFlag: h.loansOver5MFlag, priorMfiPawnshopFlag: h.priorMfiPawnshopFlag, totalOutstandingDebt: num(h.totalOutstandingDebt), avgMonthlyPaymentExisting: num(h.avgMonthlyPaymentExisting), committeeProtocolRef: h.committeeProtocolRef, committeeDecisionDate: iso(h.committeeDecisionDate) } : null;

function toCreditLine(l: CaseWithRelations['creditLine']) {
  if (!l) return null;
  const t = l.tranches[0] ?? null;
  return {
    lineNumber: l.lineNumber, loanType: l.loanType, amountAuto: num(l.amountAuto), amountPolis: num(l.amountPolis),
    amountTotal: num(l.amountTotal), termMonths: l.termMonths, lineDate: iso(l.lineDate), lineMaturity: iso(l.lineMaturity),
    interestRate: num(l.interestRate), penaltyRate: num(l.penaltyRate), orderNumber: l.orderNumber,
    requiredCollateralAmount: num(l.requiredCollateralAmount), requiredInsuredAmount: num(l.requiredInsuredAmount),
    insurance: l.insurance
      ? { insured: l.insurance.insured, company: l.insurance.company, genAgreementNo: l.insurance.genAgreementNo, genAgreementDate: iso(l.insurance.genAgreementDate), policyNo: l.insurance.policyNo, policyIssueDate: iso(l.insurance.policyIssueDate), policyTermMonths: l.insurance.policyTermMonths, policyExpiry: iso(l.insurance.policyExpiry), loanUnderPolicy: num(l.insurance.loanUnderPolicy), insuredSum: num(l.insurance.insuredSum), insuranceRate: num(l.insurance.insuranceRate), premium: num(l.insurance.premium) }
      : null,
    tranche: t
      ? { trancheNo: t.trancheNo, applicationNo: t.applicationNo, applicationDate: iso(t.applicationDate), contractNo: t.contractNo, contractDate: iso(t.contractDate), principal: num(t.principal), termMonths: t.termMonths, maturity: iso(t.maturity), scheduleType: t.scheduleType, monthlyPayment: num(t.monthlyPayment), paymentDay: t.paymentDay ?? null, insurancePayment: num(t.insurancePayment) }
      : null,
  };
}

export function toCaseDto(c: CaseWithRelations): CreditCaseDto {
  return {
    id: c.id,
    number: c.number,
    productType: c.productType,
    product: c.product ?? null,
    termBand: c.termBand ?? null,
    ltvPct: num(c.ltvPct),
    downPaymentPct: num(c.downPaymentPct),
    sellerId: c.sellerId ?? null,
    seller: c.seller ?? null,
    status: c.status,
    amount: num(c.amount),
    termMonths: c.termMonths,
    katmPrice: num(c.katmPrice),
    contractNumber: c.contractNumber ?? null,
    contractGlobalNo: c.contractGlobalNo ?? null,
    contractYearlyNo: c.contractYearlyNo ?? null,
    contractBranchSym: c.contractBranchSym ?? null,
    isReMfl: c.isReMfl,
    branch: c.branch
      ? { id: c.branch.id, name: c.branch.name, symbol: c.branch.symbol, region: c.branch.region }
      : null,
    createdByName: c.createdBy.fullName,
    borrower: c.borrower
      ? {
          id: c.borrower.id,
          fullName: c.borrower.fullName,
          passportSeries: c.borrower.passportSeries,
          passportNumber: c.borrower.passportNumber,
          pinfl: c.borrower.pinfl,
          birthDate: iso(c.borrower.birthDate),
          address: c.borrower.address,
          phone: c.borrower.phone,
          gender: c.borrower.gender,
          citizenship: c.borrower.citizenship,
          placeOfBirth: c.borrower.placeOfBirth,
          previousName: c.borrower.previousName,
          inn: c.borrower.inn,
          passportIssuer: c.borrower.passportIssuer,
          passportIssueDate: iso(c.borrower.passportIssueDate),
          passportExpiry: iso(c.borrower.passportExpiry),
          regAddress: c.borrower.regAddress,
          regLandmark: c.borrower.regLandmark,
          regTenure: c.borrower.regTenure,
          regMatchesActual: c.borrower.regMatchesActual,
          actualAddress: c.borrower.actualAddress,
          actualLandmark: c.borrower.actualLandmark,
          actualTenure: c.borrower.actualTenure,
          phones: (c.borrower.phones as string[] | null) ?? null,
          closeContacts: (c.borrower.closeContacts as CloseContactDto[] | null) ?? null,
          entrepreneurType: c.borrower.entrepreneurType,
          entrepreneurCertNo: c.borrower.entrepreneurCertNo,
          maritalStatus: c.borrower.maritalStatus,
          familySize: c.borrower.familySize,
          childrenCount: c.borrower.childrenCount,
          education: c.borrower.education,
          residenceDuration: c.borrower.residenceDuration,
          ownsHome: c.borrower.ownsHome,
          depositsBand: c.borrower.depositsBand,
        }
      : null,
    guarantors: c.guarantors.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      passportSeries: g.passportSeries,
      passportNumber: g.passportNumber,
      pinfl: g.pinfl,
      phone: g.phone,
      relation: g.relation,
    })),
    collaterals: c.collaterals.map(toCollateral),
    employment: toEmployment(c.employment),
    affordability: toAffordability(c.affordability),
    creditLine: toCreditLine(c.creditLine),
    creditHistory: toCreditHistory(c.creditHistory),
    disbursement: c.disbursement
      ? {
          holderName: c.disbursement.holderName,
          cardNumber: c.disbursement.cardNumber,
          accountNumber: c.disbursement.accountNumber,
          bankMfo: c.disbursement.bankMfo,
          holderInn: c.disbursement.holderInn,
          bankName: c.disbursement.bankName,
        }
      : null,
    documents: c.documents.filter((d) => d.type !== 'CHAT').map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      collateralId: d.collateralId ?? null,
      title: d.title ?? null,
      description: d.description ?? null,
      isGenerated: d.isGenerated,
      uploadedAt: d.createdAt.toISOString(),
      uploadedByName: d.uploadedBy?.fullName ?? null,
      mimeType: d.mimeType,
      url: `/api/documents/${d.id}/download`,
    })),
    events: c.events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      decision: e.decision,
      actorName: e.actor.fullName,
      role: e.role,
      comment: e.comment,
      createdAt: e.createdAt.toISOString(),
    })),
    stepStartedAt: iso(c.stepStartedAt),
    stepDeadlineAt: iso(c.stepDeadlineAt),
    pausedAt: iso(c.pausedAt),
    pauseUntil: iso(c.pauseUntil),
    deletedAt: iso(c.deletedAt),
    deletedReason: c.deletedReason,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toListItem(
  c: Prisma.CreditCaseGetPayload<{ include: { branch: true; borrower: true; createdBy: true } }>,
): CreditCaseListItem {
  return {
    id: c.id,
    number: c.number,
    contractNumber: c.contractNumber ?? null,
    productType: c.productType,
    status: c.status,
    amount: num(c.amount),
    borrowerName: c.borrower?.fullName ?? null,
    branchSymbol: c.branch?.symbol ?? null,
    createdByName: c.createdBy?.fullName ?? null,
    stepDeadlineAt: iso(c.stepDeadlineAt),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: iso(c.deletedAt),
    deletedReason: c.deletedReason,
  };
}
