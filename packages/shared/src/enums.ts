/**
 * Enums use the const-object + union pattern (same as Prisma's generated
 * enums) so the backend's Prisma enum values and these are mutually
 * assignable without casts. Each name is both a value and a type.
 */

/** User roles — also drives which web app a user may log into. */
export const Role = {
  OPERATOR: 'OPERATOR',
  MODERATOR: 'MODERATOR',
  DIRECTOR: 'DIRECTOR',
  ADMIN: 'ADMIN',
  COLLECTOR: 'COLLECTOR', // undiruvchi — field debt collector (mobile app, SP-3)
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Status of an undiruv (debt-collection) cycle over a case. SP-1. */
export const CollectionStatus = {
  NEW: 'NEW', // created, no collector assigned yet
  ASSIGNED: 'ASSIGNED', // collector assigned, no action yet
  IN_PROGRESS: 'IN_PROGRESS', // collector started working (SP-2 visits)
  CLOSED: 'CLOSED', // closed (fully collected or manually)
} as const;
export type CollectionStatus = (typeof CollectionStatus)[keyof typeof CollectionStatus];

/** Collateral product type. Foundation phase implements REAL_ESTATE fully. */
export const ProductType = {
  REAL_ESTATE: 'REAL_ESTATE',
  AUTO: 'AUTO',
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

/**
 * Workflow status of a credit case.
 * Drawing flow: Operator → Moderator → [Zam optional] → Director → Admin.
 */
export const CaseStatus = {
  DRAFT: 'DRAFT', // operator is filling in
  MODERATION: 'MODERATION', // submitted, waiting for moderator
  DIRECTOR_REVIEW: 'DIRECTOR_REVIEW', // moderator approved, waiting for director
  ADMIN_FINALIZE: 'ADMIN_FINALIZE', // director approved + final docs uploaded, waiting for admin
  FINALIZED: 'FINALIZED', // admin finalized (KATM price + PDF + Excel) → done
  REJECTED: 'REJECTED', // returned/rejected terminally
  CANCELLED: 'CANCELLED', // aborted by moderator/director — terminal, distinct from REJECTED
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

/** Decision recorded on each workflow transition. */
export const WorkflowDecision = {
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  RETURN: 'RETURN',
  FINALIZE: 'FINALIZE',
  CANCEL: 'CANCEL', // moderator/director aborts the case → CANCELLED
  REOPEN: 'REOPEN', // director sends an active case back to DRAFT for full re-entry
} as const;
export type WorkflowDecision = (typeof WorkflowDecision)[keyof typeof WorkflowDecision];

/** Uploaded / generated document categories (from the hand-drawn doc list). */
export const DocumentType = {
  NOTARY: 'NOTARY', // notarius (×3)
  SCAN: 'SCAN', // scanner upload
  PASSPORT: 'PASSPORT', // qarz oluvchi pasporti
  COLLATERAL_PHOTO: 'COLLATERAL_PHOTO', // zalog rasm
  TECH_PASSPORT: 'TECH_PASSPORT', // tex passport
  GEN_DOVERNOST: 'GEN_DOVERNOST', // gen doverennost (umumiy ishonchnoma) — PDF yoki rasm(lar)
  DOWN_PAYMENT_RECEIPT: 'DOWN_PAYMENT_RECEIPT', // boshlang'ich to'lov bank kvitansiyasi (rasm) — AVTO/IPOTEKA
  DIRECTOR_FINAL: 'DIRECTOR_FINAL', // 1–2 final docs the director uploads
  GENERATED_PDF: 'GENERATED_PDF', // PDF produced by the system
  CHAT: 'CHAT', // file shared inside case chat
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

/** Product subtype by amount: ≤100M микроқарз, >100M микрокредит. */
export const LoanType = { MICROLOAN: 'MICROLOAN', MICROCREDIT: 'MICROCREDIT' } as const;
export type LoanType = (typeof LoanType)[keyof typeof LoanType];

/** Repayment method — drives the schedule and the term cap. */
export const RepaymentMethod = { ANNUITY: 'ANNUITY', DIFFERENTIATED: 'DIFFERENTIATED' } as const;
export type RepaymentMethod = (typeof RepaymentMethod)[keyof typeof RepaymentMethod];

/** Seller / distributor party type for asset-purchase products (mirrors Prisma `SellerKind`). */
export const SellerKind = {
  INDIVIDUAL: 'INDIVIDUAL', // used-car owner, flat owner
  LEGAL: 'LEGAL', // avtosalon, quruvchi firma
} as const;
export type SellerKind = (typeof SellerKind)[keyof typeof SellerKind];

/** KATM report kinds — placeholder for the future integration (2–3 reports). */
export const KatmReportType = {
  CREDIT_HISTORY: 'CREDIT_HISTORY',
  SCORING: 'SCORING',
  PLEDGE_REGISTRY: 'PLEDGE_REGISTRY',
} as const;
export type KatmReportType = (typeof KatmReportType)[keyof typeof KatmReportType];
