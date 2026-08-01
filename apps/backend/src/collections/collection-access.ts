import { Prisma } from '@prisma/client';
import { Role } from '@credit-core/shared';

/**
 * Pure access + notification helpers for the undiruv (collection) domain.
 *
 * These carry the rules that are easy to get subtly wrong — who may see or manage a collection, and
 * who gets pinged when — as plain functions, so the jest suite exercises them without a database
 * (matching how the rest of the backend tests its logic).
 */

/** Roles allowed to create / edit / assign a collection (qarzdorlikni belgilash). */
export function canManageCollection(role: Role): boolean {
  return role === Role.ADMIN || role === Role.DIRECTOR || role === Role.MODERATOR;
}

/** Roles allowed to delete an unclosed collection. */
export function canDeleteCollection(role: Role): boolean {
  return role === Role.ADMIN || role === Role.DIRECTOR;
}

/**
 * The `where` that scopes a collection list to the caller, mirroring the applications list:
 * operator → their own cases, moderator → their branches, director/admin → everything.
 * `moderatorBranchIds` is only consulted for the moderator branch.
 */
export function collectionScopeWhere(
  role: Role,
  userId: string,
  moderatorBranchIds: string[],
): Prisma.CollectionWhereInput {
  if (role === Role.OPERATOR) return { case: { createdById: userId } };
  if (role === Role.MODERATOR) return { case: { branchId: { in: moderatorBranchIds } } };
  return {}; // DIRECTOR, ADMIN — unrestricted (same as the case list)
}

export type CollectionEventKind = 'created' | 'assigned';

export interface CollectionNotifyCtx {
  caseId: string;
  caseNumber: string;
  borrowerName: string | null;
  /** case.createdById — the operator who owns the application. */
  operatorId: string | null;
  /** The collector assigned (for 'assigned'). */
  collectorId: string | null;
  /** Who performed the action; never notify them about their own action. */
  actorId: string;
}

export interface NotificationSeed {
  userId: string;
  type: 'COLLECTION_CREATED' | 'COLLECTION_ASSIGNED';
  title: string;
  body: string;
  caseId: string;
}

/**
 * Which notifications a collection event produces. `created` pings the application's operator;
 * `assigned` pings the collector. The actor is never notified about their own action, and a missing
 * or self target simply yields no row.
 */
export function collectionNotifications(kind: CollectionEventKind, ctx: CollectionNotifyCtx): NotificationSeed[] {
  const who = ctx.borrowerName ? `${ctx.caseNumber} — ${ctx.borrowerName}` : ctx.caseNumber;
  const seeds: NotificationSeed[] = [];

  if (kind === 'created' && ctx.operatorId && ctx.operatorId !== ctx.actorId) {
    seeds.push({
      userId: ctx.operatorId,
      type: 'COLLECTION_CREATED',
      title: 'Arizangiz undiruvga qo‘yildi',
      body: `${who} bo‘yicha qarzdorlik belgilandi.`,
      caseId: ctx.caseId,
    });
  }
  if (kind === 'assigned' && ctx.collectorId && ctx.collectorId !== ctx.actorId) {
    seeds.push({
      userId: ctx.collectorId,
      type: 'COLLECTION_ASSIGNED',
      title: 'Sizga undiruv biriktirildi',
      body: `${who} bo‘yicha undiruv sizga biriktirildi.`,
      caseId: ctx.caseId,
    });
  }
  return seeds;
}
