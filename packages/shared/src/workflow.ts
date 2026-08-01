import { CaseStatus, Role, WorkflowDecision } from './enums';

export interface TransitionRule {
  from: CaseStatus;
  to: CaseStatus;
  role: Role;
  decision: WorkflowDecision;
  /** If true, requires at least one DIRECTOR_FINAL document to be attached. */
  requiresFinalDocs?: boolean;
  /** Override/escape-hatch action (director force-finalize, cancel) — UI confirms it. */
  override?: boolean;
}

/**
 * Single source of truth for allowed workflow transitions.
 * Used by the backend WorkflowService (guard + audit) and by the
 * frontends to decide which action buttons to show.
 */
export const TRANSITIONS: TransitionRule[] = [
  // Operator submits a draft → moderation queue. Admin may also submit a draft they created.
  { from: CaseStatus.DRAFT, to: CaseStatus.MODERATION, role: Role.OPERATOR, decision: WorkflowDecision.SUBMIT },
  { from: CaseStatus.DRAFT, to: CaseStatus.MODERATION, role: Role.ADMIN, decision: WorkflowDecision.SUBMIT },

  // Moderator approves → director, or returns → draft.
  { from: CaseStatus.MODERATION, to: CaseStatus.DIRECTOR_REVIEW, role: Role.MODERATOR, decision: WorkflowDecision.APPROVE },
  { from: CaseStatus.MODERATION, to: CaseStatus.DRAFT, role: Role.MODERATOR, decision: WorkflowDecision.RETURN },

  // Director signs (Imzolash) → FINALIZED, directly. No file attach required; the document set is
  // generated on demand from the registry. Director approval is final — there is no admin step.
  // Or returns → moderation.
  { from: CaseStatus.DIRECTOR_REVIEW, to: CaseStatus.FINALIZED, role: Role.DIRECTOR, decision: WorkflowDecision.APPROVE },
  { from: CaseStatus.DIRECTOR_REVIEW, to: CaseStatus.MODERATION, role: Role.DIRECTOR, decision: WorkflowDecision.RETURN },

  // Cancel — moderator aborts a case in their queue; director may cancel any active step.
  { from: CaseStatus.MODERATION, to: CaseStatus.CANCELLED, role: Role.MODERATOR, decision: WorkflowDecision.CANCEL, override: true },
  { from: CaseStatus.MODERATION, to: CaseStatus.CANCELLED, role: Role.DIRECTOR, decision: WorkflowDecision.CANCEL, override: true },
  { from: CaseStatus.DIRECTOR_REVIEW, to: CaseStatus.CANCELLED, role: Role.DIRECTOR, decision: WorkflowDecision.CANCEL, override: true },
  { from: CaseStatus.ADMIN_FINALIZE, to: CaseStatus.CANCELLED, role: Role.DIRECTOR, decision: WorkflowDecision.CANCEL, override: true },

  // Reopen — director sends an active case all the way back to DRAFT so the operator
  // can re-enter documents and resubmit (an alternative to a full cancel).
  { from: CaseStatus.MODERATION, to: CaseStatus.DRAFT, role: Role.DIRECTOR, decision: WorkflowDecision.REOPEN, override: true },
  { from: CaseStatus.DIRECTOR_REVIEW, to: CaseStatus.DRAFT, role: Role.DIRECTOR, decision: WorkflowDecision.REOPEN, override: true },
  { from: CaseStatus.ADMIN_FINALIZE, to: CaseStatus.DRAFT, role: Role.DIRECTOR, decision: WorkflowDecision.REOPEN, override: true },
];

/** Steps that carry an SLA deadline (the "waiting on someone" states). */
export const DEADLINE_STEPS: CaseStatus[] = [
  CaseStatus.MODERATION,
  CaseStatus.DIRECTOR_REVIEW,
];

/** Whether a status has an SLA deadline (a step timer applies). */
export function hasDeadline(status: CaseStatus): boolean {
  return DEADLINE_STEPS.includes(status);
}

/** Active (in-progress) statuses — not terminal (FINALIZED/REJECTED/CANCELLED) and not DRAFT. */
export const ACTIVE_STATUSES: CaseStatus[] = [...DEADLINE_STEPS];

/** Terminal statuses — the case is closed. */
export const TERMINAL_STATUSES: CaseStatus[] = [
  CaseStatus.FINALIZED,
  CaseStatus.REJECTED,
  CaseStatus.CANCELLED,
];

export function findTransition(
  from: CaseStatus,
  role: Role,
  decision: WorkflowDecision,
): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.role === role && t.decision === decision);
}

/** The status a given role acts on (their inbox). */
export const ROLE_INBOX_STATUS: Record<Role, CaseStatus | null> = {
  [Role.OPERATOR]: CaseStatus.DRAFT,
  [Role.MODERATOR]: CaseStatus.MODERATION,
  [Role.DIRECTOR]: CaseStatus.DIRECTOR_REVIEW,
  // Admin is no longer a workflow step — director approval is final. No inbox for admin.
  [Role.ADMIN]: null,
  // Collector is outside the origination workflow — they work undiruv, not case steps.
  [Role.COLLECTOR]: null,
};
