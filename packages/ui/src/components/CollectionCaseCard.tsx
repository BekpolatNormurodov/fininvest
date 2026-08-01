import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  COLLECTION_STATUS_LABEL,
  CollectionStatus,
  canManageCollection,
  collectionRemaining,
} from '@credit-core/shared';
import { api } from '@credit-core/api-client';
import { useAuth } from '../lib/auth';
import { Button, Card, Skeleton } from './primitives';
import { CollectionForm } from './CollectionForm';
import { Money, Edit, Plus } from '../lib/icons';
import { cn, formatMoney } from '../lib/cn';

const STATUS_TONE: Record<CollectionStatus, string> = {
  [CollectionStatus.NEW]: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  [CollectionStatus.ASSIGNED]: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  [CollectionStatus.IN_PROGRESS]: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
  [CollectionStatus.CLOSED]: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
};

/**
 * The undiruv (collection) block on a case page. Managers (admin/director/moderator) see either a
 * summary of the active collection with an edit button, or a «Undiruvga qo'yish» button when there
 * is none. Everyone else sees the summary only when a collection exists.
 */
export function CollectionCaseCard({ caseId, caseLabel }: { caseId: string; caseLabel: string }) {
  const { user } = useAuth();
  const canManage = user ? canManageCollection(user.role) : false;
  const [open, setOpen] = useState(false);

  const { data: collection, isLoading } = useQuery({
    queryKey: ['collection', caseId],
    queryFn: () => api.collectionForCase(caseId),
  });
  const { data: collectors } = useQuery({
    queryKey: ['collectors'],
    queryFn: () => api.collectors(),
    enabled: canManage,
  });
  const collectorRefs = (collectors ?? []).filter((c) => c.isActive).map((c) => ({ id: c.id, fullName: c.fullName }));

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (!collection && !canManage) return null;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white">
          <Money className="h-4 w-4 text-gray-400" /> Undiruv
        </h2>
        {collection && (
          <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', STATUS_TONE[collection.status])}>
            {COLLECTION_STATUS_LABEL[collection.status]}
          </span>
        )}
      </div>

      {collection ? (
        <>
          <dl className="space-y-2 text-sm">
            <Row label="Undiruvchi" value={collection.collector?.fullName ?? <span className="text-gray-400">Biriktirilmagan</span>} />
            <Row label="Jami qarzdorlik" value={<span className="nums font-semibold text-gray-800 dark:text-white">{formatMoney(collection.totalDebt)}</span>} />
            <Row label="Undirilgan" value={<span className="nums text-success-600 dark:text-success-400">{formatMoney(collection.collectedAmount)}</span>} />
            <Row label="Qoldiq" value={<span className="nums font-medium text-warning-700 dark:text-warning-400">{formatMoney(collectionRemaining(collection.totalDebt, collection.collectedAmount))}</span>} />
            <Row label="Oylar" value={`${collection.months.length} ta`} />
          </dl>
          {canManage && (
            <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}><Edit className="h-4 w-4" /> Tahrirlash</Button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">Bu ariza bo‘yicha undiruv ochilmagan.</p>
          <Button className="w-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Undiruvga qo‘yish</Button>
        </>
      )}

      {open && (
        <CollectionForm
          open
          onClose={() => setOpen(false)}
          caseId={caseId}
          caseLabel={caseLabel}
          collection={collection ?? undefined}
          collectors={collectorRefs}
        />
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-gray-700 dark:text-gray-200">{value}</dd>
    </div>
  );
}
