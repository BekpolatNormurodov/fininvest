import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  COLLECTION_STATUS_LABEL,
  CollectionStatus,
  collectionStats,
  matchesCollectionFilter,
  EMPTY_COLLECTION_FILTER,
  type CollectionListItem,
  type CollectionFilter,
} from '@credit-core/shared';
import { api } from '@credit-core/api-client';
import { Button, Skeleton } from '../components/primitives';
import { MetricCard } from '../components/widgets';
import { DataTable, type Column } from '../components/DataTable';
import { Select } from '../components/forms';
import { CollectionForm } from '../components/CollectionForm';
import { CollectionDeadlineBadge } from '../components/CollectionDeadlineBadge';
import { Modal } from '../components/Modal';
import { Money, Bank, Layers, Plus, Percent } from '../lib/icons';
import { cn, formatMoney } from '../lib/cn';

const STATUS_TONE: Record<CollectionStatus, string> = {
  [CollectionStatus.NEW]: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  [CollectionStatus.ASSIGNED]: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  [CollectionStatus.IN_PROGRESS]: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
  [CollectionStatus.CLOSED]: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
};

function StatusChip({ status }: { status: CollectionStatus }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', STATUS_TONE[status])}>
      {COLLECTION_STATUS_LABEL[status]}
    </span>
  );
}

export function CollectionsPage() {
  const [status, setStatus] = useState<CollectionStatus | ''>('');
  const [collectorId, setCollectorId] = useState('');
  const [branch, setBranch] = useState('');
  const [picking, setPicking] = useState(false);
  const [formCaseId, setFormCaseId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({ queryKey: ['collections'], queryFn: () => api.collections() });
  const { data: collectors } = useQuery({ queryKey: ['collectors'], queryFn: () => api.collectors() });
  const { data: editing } = useQuery({
    queryKey: ['collection', 'detail', editId],
    queryFn: () => api.collection(editId!),
    enabled: !!editId,
  });

  const filter: CollectionFilter = useMemo(
    () => ({
      ...EMPTY_COLLECTION_FILTER,
      statuses: status ? new Set([status]) : new Set(),
      collectorIds: collectorId ? new Set([collectorId]) : new Set(),
      branches: branch ? new Set([branch]) : new Set(),
    }),
    [status, collectorId, branch],
  );

  const filtered = useMemo(() => (rows ?? []).filter((r) => matchesCollectionFilter(filter, r)), [rows, filter]);
  const stats = useMemo(() => collectionStats(filtered), [filtered]);

  const branchOpts = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.branchName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'uz')),
    [rows],
  );
  const activeCollectors = (collectors ?? []).filter((c) => c.isActive);
  const collectorRefs = activeCollectors.map((c) => ({ id: c.id, fullName: c.fullName }));

  const columns: Column<CollectionListItem>[] = [
    {
      key: 'caseNumber', header: 'Ariza', sortable: true, sortValue: (c) => c.caseNumber,
      render: (c) => (
        <span className="min-w-0">
          <span className="nums block font-semibold text-gray-800 dark:text-white">{c.contractNumber ?? c.caseNumber}</span>
          {c.contractNumber && <span className="block text-[11px] text-gray-400">{c.caseNumber}</span>}
        </span>
      ),
    },
    { key: 'borrowerName', header: 'Qarz oluvchi', sortable: true, render: (c) => c.borrowerName ?? '—' },
    { key: 'branchName', header: 'Filial', sortable: true, render: (c) => c.branchName ?? '—' },
    { key: 'collectorName', header: 'Undiruvchi', sortable: true, render: (c) => c.collectorName ?? <span className="text-gray-400">—</span> },
    {
      key: 'totalDebt', header: 'Qarzdorlik', align: 'right', className: 'nums font-medium', sortable: true,
      sortValue: (c) => c.totalDebt, render: (c) => formatMoney(c.totalDebt),
    },
    {
      key: 'collectedAmount', header: 'Undirilgan', align: 'right', className: 'nums', sortable: true,
      sortValue: (c) => c.collectedAmount, render: (c) => <span className="text-success-600 dark:text-success-400">{formatMoney(c.collectedAmount)}</span>,
    },
    { key: 'status', header: 'Holat', sortable: true, sortValue: (c) => c.status, render: (c) => <StatusChip status={c.status} /> },
    {
      key: 'deadlineAt', header: 'Muddat', sortable: true, sortValue: (c) => c.deadlineAt ?? '',
      render: (c) => <CollectionDeadlineBadge deadlineAt={c.deadlineAt} closed={c.status === CollectionStatus.CLOSED} />,
    },
    {
      key: 'createdAt', header: 'Sana', align: 'right', sortable: true, sortValue: (c) => c.createdAt,
      render: (c) => <span className="whitespace-nowrap text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ru-RU')}</span>,
    },
  ];

  const statusOptions = (Object.keys(COLLECTION_STATUS_LABEL) as CollectionStatus[]).map((s) => ({ value: s, label: COLLECTION_STATUS_LABEL[s] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Undiruv</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Qarzdorlik va undiruvchilar</p>
        </div>
        <Button onClick={() => setPicking(true)}><Plus className="h-4 w-4" /> Yangi undiruv</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Bank} label="Jami qarzdorlik" value={formatMoney(stats.totalDebt)} tone="danger" />
        <MetricCard icon={Money} label="Undirilgan" value={formatMoney(stats.totalCollected)} tone="success" />
        <MetricCard icon={Percent} label="Qoldiq" value={formatMoney(stats.remaining)} tone="warning" />
        <MetricCard icon={Layers} label="Faol undiruvlar" value={String(stats.activeCount)} tone="brand" />
      </div>

      {/* By-collector breakdown (top exposures). */}
      {stats.byCollector.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/5">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white">Undiruvchilar bo‘yicha</h3>
          <div className="space-y-2">
            {stats.byCollector.slice(0, 6).map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-700 dark:text-gray-200">{s.label}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-gray-400">{s.count} ta</span>
                  <span className="nums text-gray-500">{formatMoney(s.totalDebt)}</span>
                  <span className="nums font-medium text-success-600">{formatMoney(s.collected)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          searchable
          searchFields={['caseNumber', 'contractNumber', 'borrowerName', 'collectorName']}
          onRowClick={(c) => setEditId(c.id)}
          empty="Undiruv yo‘q"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40"><Select value={status} onChange={(v) => setStatus(v as CollectionStatus)} options={statusOptions} placeholder="Holat" /></div>
              <div className="w-44"><Select value={collectorId} onChange={setCollectorId} options={collectorRefs.map((c) => ({ value: c.id, label: c.fullName }))} placeholder="Undiruvchi" searchable /></div>
              <div className="w-44"><Select value={branch} onChange={setBranch} options={branchOpts.map((b) => ({ value: b, label: b }))} placeholder="Filial" searchable /></div>
              {(status || collectorId || branch) && (
                <button type="button" onClick={() => { setStatus(''); setCollectorId(''); setBranch(''); }} className="text-xs font-medium text-gray-500 hover:text-error-600">Tozalash</button>
              )}
            </div>
          }
        />
      )}

      {/* Pick a case for a brand-new collection. */}
      <CasePicker open={picking} onClose={() => setPicking(false)} onPick={(id) => { setPicking(false); setFormCaseId(id); }} />

      {/* Create form. */}
      {formCaseId && (
        <CollectionForm
          open
          onClose={() => setFormCaseId(null)}
          caseId={formCaseId}
          caseLabel="Yangi undiruv"
          collectors={collectorRefs}
        />
      )}

      {/* Edit form. */}
      {editId && editing && (
        <CollectionForm
          open
          onClose={() => setEditId(null)}
          caseId={editing.caseId}
          caseLabel={editing.contractNumber ?? editing.caseNumber}
          collection={editing}
          collectors={collectorRefs}
        />
      )}
    </div>
  );
}

/** A small modal that lists active cases so the officer can open a collection on one. */
function CasePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (caseId: string) => void }) {
  const [caseId, setCaseId] = useState('');
  const { data: cases } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases(false), enabled: open });
  const opts = (cases ?? []).map((c) => ({
    value: c.id,
    label: `${c.contractNumber ?? c.number} — ${c.borrowerName ?? '—'}`,
  }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Arizani tanlang"
      description="Qaysi ariza bo‘yicha undiruv ochamiz?"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Bekor</Button>
          <Button disabled={!caseId} onClick={() => onPick(caseId)}>Davom etish</Button>
        </div>
      }
    >
      <Select value={caseId} onChange={setCaseId} options={opts} placeholder="Ariza tanlang" searchable />
    </Modal>
  );
}
