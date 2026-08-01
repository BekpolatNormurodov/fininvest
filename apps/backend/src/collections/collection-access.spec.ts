import { Role } from '@credit-core/shared';
import {
  canDeleteCollection,
  canManageCollection,
  collectionNotifications,
  collectionScopeWhere,
  type CollectionNotifyCtx,
} from './collection-access';

/*
  Pure access + notification rules for the undiruv domain. No database — the risky bits (who may act,
  who gets pinged) are plain functions so they are exercised here directly.
*/

describe('who may manage / delete a collection', () => {
  it('admin, director and moderator may manage; operator and collector may not', () => {
    expect(canManageCollection(Role.ADMIN)).toBe(true);
    expect(canManageCollection(Role.DIRECTOR)).toBe(true);
    expect(canManageCollection(Role.MODERATOR)).toBe(true);
    expect(canManageCollection(Role.OPERATOR)).toBe(false);
    expect(canManageCollection(Role.COLLECTOR)).toBe(false);
  });

  it('only admin and director may delete', () => {
    expect(canDeleteCollection(Role.ADMIN)).toBe(true);
    expect(canDeleteCollection(Role.DIRECTOR)).toBe(true);
    expect(canDeleteCollection(Role.MODERATOR)).toBe(false);
    expect(canDeleteCollection(Role.OPERATOR)).toBe(false);
  });
});

describe('collectionScopeWhere — list scoping mirrors the applications list', () => {
  it('operator sees only their own cases', () => {
    expect(collectionScopeWhere(Role.OPERATOR, 'u1', [])).toEqual({ case: { createdById: 'u1' } });
  });
  it('moderator is limited to their branches', () => {
    expect(collectionScopeWhere(Role.MODERATOR, 'u1', ['b1', 'b2'])).toEqual({ case: { branchId: { in: ['b1', 'b2'] } } });
  });
  it('director and admin are unrestricted', () => {
    expect(collectionScopeWhere(Role.DIRECTOR, 'u1', [])).toEqual({});
    expect(collectionScopeWhere(Role.ADMIN, 'u1', [])).toEqual({});
  });

  it('collector sees collections assigned to them OR in a branch they cover', () => {
    expect(collectionScopeWhere(Role.COLLECTOR, 'col1', ['b1', 'b2'])).toEqual({
      OR: [{ assignedCollectorId: 'col1' }, { case: { branchId: { in: ['b1', 'b2'] } } }],
    });
  });
});

describe('collectionNotifications — who gets pinged', () => {
  const base: CollectionNotifyCtx = {
    caseId: 'c1', caseNumber: 'BR-7', borrowerName: 'Ali Valiyev',
    operatorId: 'op1', collectorId: 'col1', actorId: 'mod1',
  };

  it('a created collection notifies the application operator', () => {
    const seeds = collectionNotifications('created', base);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({ userId: 'op1', type: 'COLLECTION_CREATED', caseId: 'c1' });
    expect(seeds[0].body).toContain('BR-7');
    expect(seeds[0].body).toContain('Ali Valiyev');
  });

  it('an assigned collection notifies the collector', () => {
    const seeds = collectionNotifications('assigned', base);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({ userId: 'col1', type: 'COLLECTION_ASSIGNED' });
  });

  it('never notifies the actor about their own action', () => {
    expect(collectionNotifications('created', { ...base, operatorId: 'mod1' })).toHaveLength(0);
    expect(collectionNotifications('assigned', { ...base, collectorId: 'mod1' })).toHaveLength(0);
  });

  it('yields nothing when the target is missing', () => {
    expect(collectionNotifications('created', { ...base, operatorId: null })).toHaveLength(0);
    expect(collectionNotifications('assigned', { ...base, collectorId: null })).toHaveLength(0);
  });

  it('falls back to the case number when there is no borrower name', () => {
    const seeds = collectionNotifications('created', { ...base, borrowerName: null });
    expect(seeds[0].body).toContain('BR-7');
  });
});
