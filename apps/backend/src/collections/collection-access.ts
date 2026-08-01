import { Prisma } from '@prisma/client';
import { Role } from '@credit-core/shared';

/**
 * Pure access + notification helpers for the undiruv (collection) domain.
 *
 * The scope and notification-targeting rules live here (easy to get subtly wrong, so tested without
 * a database). The role guards themselves are shared with the web via `@credit-core/shared`.
 */

// The can-manage / can-delete role guards are shared with the web UI.
export { canManageCollection, canDeleteCollection } from '@credit-core/shared';

/**
 * The `where` that scopes a collection list to the caller:
 *  - operator  → their own cases (applications list parity),
 *  - moderator → their branches,
 *  - collector → collections assigned to them OR in a branch they cover (the mobile app view),
 *  - director/admin → everything.
 *
 * `branchIds` are the caller's covered branches — their `moderatedBranches` for a moderator, their
 * `collectedBranches` for a collector; ignored for the other roles.
 */
export function collectionScopeWhere(
  role: Role,
  userId: string,
  branchIds: string[],
): Prisma.CollectionWhereInput {
  if (role === Role.OPERATOR) return { case: { createdById: userId } };
  if (role === Role.MODERATOR) return { case: { branchId: { in: branchIds } } };
  if (role === Role.COLLECTOR) {
    return { OR: [{ assignedCollectorId: userId }, { case: { branchId: { in: branchIds } } }] };
  }
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
