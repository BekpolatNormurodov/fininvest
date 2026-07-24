import { CaseStatus, DocumentType, ProductType, Role, SellerKind, WorkflowDecision } from './enums';
import type { LoanProduct, TermBand } from './loan-product';

/** Seller / distributor (firm or individual owner) for asset-purchase products. */
export interface SellerDto {
  id: string;
  kind: SellerKind;
  fullName?: string | null;
  pinfl?: string | null;
  passport?: string | null;
  address?: string | null;
  orgName?: string | null;
  stir?: string | null;
  directorName?: string | null;
  legalAddress?: string | null;
  phone?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  mfoCode?: string | null;
  ownershipDoc?: string | null;
  category?: string | null; // 'AUTO' (avtosalon) | 'REALTY' (quruvchi) — for catalog firms
  isCatalog?: boolean;
}
export type SellerInput = Omit<SellerDto, 'id'>;

export interface AuthUser {
  id: string;
  fullName: string;
  login: string;
  role: Role;
  branchId: string | null;
  branch?: BranchDto | null;
  phone?: string | null;
  hasAvatar?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface BranchModeratorDto {
  id: string;
  fullName: string;
}

export interface BranchDto {
  id: string;
  name: string;
  symbol: string;
  region: string | null;
  moderators?: BranchModeratorDto[];
  caseCount?: number;
  totalAmount?: number;
}

export interface CollateralOwnerDto {
  id?: string;
  fullName: string;
  passportSeries: string | null;
  passportNumber: string | null;
  pinfl: string | null;
  sharePercent: number | null;
}

/** Unified collateral — REAL_ESTATE uses the address/cadastre fields,
 *  AUTO uses the vehicle fields. A case can hold several. */
export interface CollateralDto {
  id?: string;
  type: ProductType;
  agreedValue: number | null;
  agreedValueWords: string | null;
  // real estate
  realtyKind?: 'HOUSE' | 'APARTMENT' | null; // Hovli | Kvartira
  address?: string | null;
  registryNo?: string | null;
  propertyType?: string | null;
  cadastreNo?: string | null;
  registrationDate?: string | null;
  landAreaM2?: number | null; // Hovli: yer maydoni (registered land area)
  totalAreaM2?: number | null;
  usableAreaM2?: number | null; // Hovli: umumiy foydali maydon
  livingAreaM2?: number | null;
  roomNames?: string | null;
  roomCount?: number | null;
  // auto
  techPassportNo?: string | null;
  techPassportDate?: string | null;
  model?: string | null;
  stateNumber?: string | null;
  bodyType?: string | null;
  bodyNo?: string | null;
  engineNo?: string | null;
  chassis?: string | null;
  color?: string | null;
  year?: number | null;
  mileage?: number | null;
  owners: CollateralOwnerDto[];
}

/** A borrower's close contact (yaqin kishi) — relationship + name + phone. 2 required, up to 5. */
export interface CloseContactDto {
  relation: string | null;
  fullName: string | null;
  phone: string | null;
}

export interface BorrowerDto {
  id?: string;
  fullName: string;
  passportSeries: string | null;
  passportNumber: string | null;
  pinfl: string | null;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  citizenship?: string | null;
  placeOfBirth?: string | null;
  previousName?: string | null;
  inn?: string | null;
  passportIssuer?: string | null;
  passportIssueDate?: string | null;
  passportExpiry?: string | null;
  regAddress?: string | null;
  regLandmark?: string | null;
  regTenure?: string | null;
  regMatchesActual?: boolean | null;
  actualAddress?: string | null;
  actualLandmark?: string | null;
  actualTenure?: string | null;
  phones?: string[] | null;
  maritalStatus?: string | null;
  familySize?: number | null;
  childrenCount?: number | null;
  education?: string | null;
  residenceDuration?: string | null;
  ownsHome?: string | null;
  depositsBand?: string | null;
  closeContacts?: CloseContactDto[] | null;
  // >100M (mikrokredit): entrepreneur status + certificate (guvohnoma) number.
  entrepreneurType?: string | null;
  entrepreneurCertNo?: string | null;
}

export interface EmploymentDto {
  employer: string | null;
  employerAddress: string | null;
  sector: string | null;
  sectorRiskCode: number | null;
  position: string | null;
  employedSince: string | null;
  experienceBand: string | null;
}

export interface AffordabilityDto {
  mainActivityIncome: number | null;
  secondaryIncome: number | null;
  familyIncome: number | null;
  otherIncome: number | null;
  utilitiesExpense: number | null;
  familyExpense: number | null;
  otherExpense: number | null;
  existingCreditBurden: number | null;
  newLoanPayment: number | null;
}

export interface InsurancePolicyDto {
  insured: boolean;
  company: string | null;
  genAgreementNo: string | null;
  genAgreementDate: string | null;
  policyNo: string | null;
  policyIssueDate: string | null;
  policyTermMonths: number | null;
  policyExpiry: string | null;
  loanUnderPolicy: number | null;
  insuredSum: number | null;
  insuranceRate: number | null;
  premium: number | null;
}

export interface TrancheDto {
  trancheNo: number | null;
  applicationNo: string | null;
  applicationDate: string | null;
  contractNo: string | null;
  contractDate: string | null;
  principal: number | null;
  termMonths: number | null;
  maturity: string | null;
  scheduleType: 'ANNUITY' | 'DIFFERENTIATED' | null;
  monthlyPayment: number | null;
  paymentDay: number | null; // har oy to'lov kuni — min(ariza kuni, 15)
  insurancePayment: number | null;
}

export interface CreditLineDto {
  lineNumber: string | null;
  loanType: 'MICROLOAN' | 'MICROCREDIT' | null;
  amountAuto: number | null;
  amountPolis: number | null;
  amountTotal: number | null;
  requiredCollateralAmount: number | null; // override for amountAuto × 140% (null → computed)
  requiredInsuredAmount: number | null;    // override for amountPolis × 130% insured sum (null → computed)
  termMonths: number | null;
  lineDate: string | null;
  lineMaturity: string | null;
  interestRate: number | null; // fraction
  penaltyRate: number | null;  // fraction
  orderNumber: string | null;
  insurance: InsurancePolicyDto | null;
  tranche: TrancheDto | null;
}

export interface CreditHistoryDto {
  repaidLoansCount: number | null;
  activeLoansCount: number | null;
  overdueSubstandardFlag: number | null;
  otherObligations: number | null;
  loansOver5MFlag: string | null;
  priorMfiPawnshopFlag: string | null;
  totalOutstandingDebt: number | null;
  avgMonthlyPaymentExisting: number | null;
  committeeProtocolRef: string | null;
  committeeDecisionDate: string | null;
}

export interface GuarantorDto {
  id?: string;
  fullName: string;
  passportSeries: string | null;
  passportNumber: string | null;
  pinfl: string | null;
  phone: string | null;
  relation: string | null;
}

export interface DocumentDto {
  id: string;
  type: DocumentType;
  fileName: string;
  collateralId?: string | null;
  title?: string | null;
  description?: string | null;
  isGenerated: boolean;
  uploadedAt: string;
  uploadedByName: string | null;
  mimeType: string | null;
  url: string;
}

export interface DirectoryUser {
  id: string;
  fullName: string;
  role: Role;
  branchName: string | null;
}

/** Everyone with access to a case's chat (operator creator, branch moderators, directors, admins). */
export interface CaseParticipantDto {
  id: string;
  fullName: string;
  role: Role;
}

export interface MessageDto {
  id: string;
  caseId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  text: string | null;
  toRole: Role | null;
  toUserId: string | null;
  toUserName: string | null;
  document: DocumentDto | null;
  documents: DocumentDto[];
  mine: boolean;
  /** Names of people (other than the sender) who have read this message. */
  readByNames: string[];
  /** True only for the sender while nobody else has read it yet (edit/delete allowed). */
  editable: boolean;
  edited: boolean;
  createdAt: string;
}

/** Per-case unread message count (for the conversations list). */
export interface CaseUnread {
  caseId: string;
  count: number;
}

export interface NotificationItem {
  id: string;
  caseId: string;
  caseNumber: string;
  senderName: string;
  senderRole: Role;
  text: string | null;
  toRole: Role | null;
  hasFile: boolean;
  read: boolean;
  createdAt: string;
}

/** Result of an on-prem passport MRZ scan (POST /passport/scan). Stateless — nothing persisted. */
export interface PassportScanResult {
  /** 0..100 accuracy from weighted MRZ check-digit validation. */
  confidence: number;
  fields: {
    fullName: string;
    passportSeries: string;
    passportNumber: string;
    birthDate: string | null;
    passportExpiry: string | null;
    gender: 'MALE' | 'FEMALE' | '';
    nationality: string; // localized citizenship name, '' if unknown
    pinfl: string;
    // ID-card only (optional; passport results omit these):
    placeOfBirth?: string;
    passportIssueDate?: string | null; // ISO
    passportIssuer?: string;
  };
  /** Per check-digit outcome, for the UI validity chips. */
  perField: { key: string; value: string; valid: boolean }[];
  format: string; // 'TD1' | 'TD2' | 'TD3' | ''
  rawMrz: string[];
  // 'mrz_not_found' | 'low_confidence' | 'expired' | 'expiring_soon' | 'id_back_mrz_not_found' | 'front_back_mismatch'
  warnings: string[];
  docType?: 'PASSPORT' | 'ID';
  /** Field keys whose values come from OCR (no check digit) → UI shows a "tekshiring" hint. */
  unverifiedFields?: string[];
}

/** OCR result for a vehicle registration certificate (tex passport) — maps to an AUTO collateral.
 *  There is no MRZ, so all fields are OCR-read (no check digits): review before trusting. */
export interface TexScanResult {
  /** 0..100 heuristic — share of the expected numbered fields that were recognized. */
  confidence: number;
  fields: {
    stateNumber: string;   // 1 — davlat raqami (plate)
    model: string;         // 2 — rusumi/model
    color: string;         // 3 — rangi
    ownerName: string;     // 4 — egasi
    address: string;       // 5 — manzil
    techPassportDate: string | null; // 6 — berilgan sanasi (ISO)
    issuer: string;        // 7 — bergan bo'lim (IOB)
    year: number | null;   // 9 — ishlab chiqarilgan yili
    bodyType: string;      // 10 — kuzov turi (e.g. YENGIL SEDAN)
    bodyNo: string;        // 11 — kuzov/shassi raqami (VIN)
    chassis: string;       // 11 — shassi (often RAKAMSIZ)
    engineNo: string;      // 14 — dvigatel raqami
    techPassportNo: string; // certificate series/number (e.g. VL8011449)
  };
  /** Non-empty field keys, for the UI review chips (all unverified — no check digit). */
  perField: { key: string; value: string }[];
  // 'tex_not_found' | 'low_confidence' | 'back_not_found'
  warnings: string[];
}

export interface StatsResponse {
  byStatus: { status: CaseStatus; count: number }[];
  byBranch: { branch: string; count: number; amount: number }[];
  byProduct: { product: ProductType; count: number; amount: number }[];
  byMonth: { month: string; count: number; amount: number }[];
  /** Product mix per calendar month (last 6), for a stacked bar. */
  byProductMonth: { month: string; realEstate: number; auto: number }[];
  totalCases: number;
  totalAmount: number;
  totalKatm: number;
  totalCollateralValue: number;
  avgAmount: number;
  approvalRate: number; // finalized / total, 0..1
  finalizedCount: number;
  activeCount: number; // in-progress (not finalized/rejected)
  overdueCount: number; // active steps past their SLA deadline (not paused)
  pausedCount: number; // currently on hold
  recent: CreditCaseListItem[];
}

export interface WorkflowEventDto {
  id: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  decision: WorkflowDecision;
  actorName: string;
  role: Role;
  comment: string | null;
  createdAt: string;
}

/** Beneficiary bank requisites for the disbursement application (may be a third party's account). */
export interface DisbursementDto {
  holderName: string | null;
  cardNumber: string | null;
  accountNumber: string | null;
  bankMfo: string | null;
  holderInn: string | null;
  bankName: string | null;
}

export interface CreditCaseDto {
  id: string;
  number: string;
  productType: ProductType;
  /** fin-invest: the loan product (ADM_TEAM/OSON/AVTO/IPOTEKA); null on legacy cases. */
  product?: LoanProduct | null;
  termBand?: TermBand | null;
  ltvPct?: number | null;
  downPaymentPct?: number | null;
  sellerId?: string | null;
  seller?: SellerDto | null;
  status: CaseStatus;
  amount: number | null;
  termMonths: number | null;
  katmPrice: number | null;
  // Auto contract number (assigned on submit) — separate from `number` (ariza id).
  contractNumber: string | null;
  contractGlobalNo: number | null;
  contractYearlyNo: number | null;
  contractBranchSym: string | null;
  isReMfl: boolean;
  branch: BranchDto | null;
  createdByName: string;
  borrower: BorrowerDto | null;
  guarantors: GuarantorDto[];
  collaterals: CollateralDto[];
  employment: EmploymentDto | null;
  affordability: AffordabilityDto | null;
  creditLine: CreditLineDto | null;
  creditHistory: CreditHistoryDto | null;
  /** Beneficiary bank requisites for the disbursement application (may be a third party's account). */
  disbursement?: DisbursementDto | null;
  documents: DocumentDto[];
  events: WorkflowEventDto[];
  /** When the case entered its current step (null for DRAFT / terminal). */
  stepStartedAt: string | null;
  /** SLA deadline for the current step (null when the step has no timer). */
  stepDeadlineAt: string | null;
  /** When set, the case is on hold and the SLA timer is suspended. */
  pausedAt: string | null;
  /** Auto-resume moment for the active pause (set when pausing; null otherwise). */
  pauseUntil: string | null;
  /** Soft-delete: when set, the (draft) case is archived — visible only in the Arxiv view. */
  deletedAt: string | null;
  deletedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A repeat-client's prior contract, shown in the Qayta MFL search results (operator picks one). */
export interface ReMflContractDto {
  caseId: string;
  contractNumber: string | null;
  contractYearlyNo: number | null;
  contractBranchSym: string | null;
  status: CaseStatus;
  date: string; // case createdAt ISO
  amount: number | null;
  fullName: string;
}

export interface CreditCaseListItem {
  id: string;
  number: string;
  /** Auto MFL contract number, e.g. "1023 MFL 913 PS" (null until submitted). */
  contractNumber: string | null;
  productType: ProductType;
  status: CaseStatus;
  amount: number | null;
  borrowerName: string | null;
  branchSymbol: string | null;
  createdByName: string | null;
  /** SLA deadline for the current step (null when the step has no timer). */
  stepDeadlineAt: string | null;
  updatedAt: string;
  /** Soft-delete marker for the Arxiv view (null for active cases). */
  deletedAt?: string | null;
  deletedReason?: string | null;
}

/** Admin-configured SLA: business days allowed per workflow step. */
export interface StepDeadlineSetting {
  step: CaseStatus;
  businessDays: number;
  /** When false, the step has no timer (no deadline, countdown or overdue alert). */
  enabled: boolean;
}

/** Global admin config: pause limit + loan economics rates (fractions, e.g. 0.41 = 41%). */
export interface AppConfigDto {
  maxPauseDays: number;
  markupPercent: number;
  bankRate: number;
  taxRate: number;
  nplRate: number;
  minRate: number; // lending rate floor (fraction, default 0.55)
  maxRate: number; // lending rate ceiling (fraction, default 0.60)
}

/** Payload to create or update a case (manual form OR import-confirmed). */
export interface UpsertCasePayload {
  amount: number | null;
  termMonths: number | null;
  /** fin-invest: chosen product (ADM_TEAM/OSON/AVTO/IPOTEKA); null on legacy/credit-core cases. */
  product?: LoanProduct | null;
  /** fin-invest: seller/distributor for asset-purchase products (AVTO/IPOTEKA). */
  sellerId?: string | null;
  borrower: BorrowerDto;
  guarantors: GuarantorDto[];
  collaterals: CollateralDto[];
  employment?: EmploymentDto | null;
  affordability?: AffordabilityDto | null;
  creditLine?: CreditLineDto | null;
  creditHistory?: CreditHistoryDto | null;
}

export type CaseSectionKey = 'borrower' | 'employment' | 'affordability' | 'creditLine' | 'creditHistory';

export interface CaseSectionPayload {
  section: CaseSectionKey;
  data: UpsertCasePayload;
}

export interface SetRatePayload {
  interestRate: number; // fraction, within [minRate, maxRate]
  reason: string;       // mandatory justification (audited)
}

/** Admin audit-log read row. */
export interface AuditLogDto {
  id: string;
  action: string;
  actorName: string;
  role: string;
  caseId: string | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

export interface TransitionPayload {
  decision: WorkflowDecision;
  comment?: string;
}

/** Result of parsing an uploaded .xlsx — prefilled, operator confirms. */
export interface ImportParseResult {
  borrower: Partial<BorrowerDto>;
  collateral: Partial<CollateralDto>;
  amount: number | null;
  warnings: string[];
}
