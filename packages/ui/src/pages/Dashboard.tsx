import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, House, Car, Layers, FileCheck2, Banknote, FileSpreadsheet, Trash, Return } from '../lib/icons';
import { api, downloadBlob } from '@credit-core/api-client';
import { ProductType, PRODUCT_LABEL, Role, type CreditCaseListItem } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Skeleton, StatusBadge } from '../components/primitives';
import { MetricCard } from '../components/widgets';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { DataTable, type Column } from '../components/DataTable';
import { useCaseFilters } from '../components/CaseFilters';
import { useToast } from '../components/Toast';
import { useI18n } from '../lib/i18n';
import { cn, formatMoney } from '../lib/cn';

const productCell = (c: CreditCaseListItem) => (
  <div className="flex items-center gap-2.5">
    <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${c.productType === ProductType.AUTO ? 'bg-warning-600' : 'bg-brand-700'}`}>
      {c.productType === ProductType.AUTO ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
    </span>
    <span className="min-w-0">
      <span className="nums block font-semibold text-gray-800 dark:text-white">{c.contractNumber ?? c.number}</span>
      {c.contractNumber && <span className="block text-[11px] text-gray-400 dark:text-gray-500">{c.number}</span>}
    </span>
  </div>
);

export function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isOperator = user?.role === Role.OPERATOR;
  const canCreate = user?.role === Role.OPERATOR || user?.role === Role.ADMIN;
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const { lang } = useI18n();
  const { data: cases, isLoading } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases(false) });
  // The filter bar sits next to the applications table's search; it derives region/branch options
  // from the loaded rows and hands the table a predicate.
  const filters = useCaseFilters(cases ?? [], lang);
  const { data: archived, isLoading: archLoading } = useQuery({
    queryKey: ['cases', 'archived'],
    queryFn: () => api.archivedCases(),
    enabled: tab === 'archived',
  });
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.stats() });

  const restore = useMutation({
    mutationFn: (id: string) => api.restoreCase(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); toast.success('Aktivlashtirildi', 'Ariza faol ro‘yxatga qaytdi'); },
    onError: () => toast.error('Xatolik', 'Qaytarib bo‘lmadi'),
  });

  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try { downloadBlob(await api.exportAllCases(), 'Arizalar.xlsx'); } finally { setExporting(false); }
  };

  const activeColumns: Column<CreditCaseListItem>[] = [
    { key: 'number', header: 'Ariza', sortable: true, sortValue: (c) => c.number, render: productCell },
    { key: 'borrowerName', header: 'Qarz oluvchi', sortable: true, render: (c) => c.borrowerName ?? '—' },
    { key: 'product', header: 'Mahsulot', sortable: true, sortValue: (c) => PRODUCT_LABEL[c.productType], render: (c) => PRODUCT_LABEL[c.productType] },
    { key: 'branchSymbol', header: 'Filial', sortable: true, render: (c) => c.branchSymbol ?? '—' },
    { key: 'createdByName', header: 'Xodim', sortable: true, render: (c) => <span className="text-gray-600 dark:text-gray-300">{c.createdByName ?? '—'}</span> },
    { key: 'amount', header: 'Summa', align: 'right', className: 'nums font-medium', sortable: true, sortValue: (c) => c.amount ?? 0, render: (c) => formatMoney(c.amount) },
    {
      key: 'status', header: 'Holat', sortable: true, sortValue: (c) => c.status,
      render: (c) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={c.status} />
          <DeadlineBadge deadlineAt={c.stepDeadlineAt} compact />
        </div>
      ),
    },
    {
      key: 'updatedAt', header: 'Oxirgi o‘zgarish', align: 'right', sortable: true, sortValue: (c) => c.updatedAt,
      render: (c) => <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{new Date(c.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>,
    },
  ];

  const archivedColumns: Column<CreditCaseListItem>[] = [
    { key: 'number', header: 'Ariza', sortable: true, sortValue: (c) => c.number, render: productCell },
    { key: 'borrowerName', header: 'Qarz oluvchi', sortable: true, render: (c) => c.borrowerName ?? '—' },
    { key: 'createdByName', header: 'Xodim', sortable: true, render: (c) => <span className="text-gray-600 dark:text-gray-300">{c.createdByName ?? '—'}</span> },
    { key: 'amount', header: 'Summa', align: 'right', className: 'nums font-medium', sortable: true, sortValue: (c) => c.amount ?? 0, render: (c) => formatMoney(c.amount) },
    {
      key: 'deletedReason', header: 'Sabab', render: (c) => (
        <span className="line-clamp-1 max-w-[220px] text-gray-600 dark:text-gray-300" title={c.deletedReason ?? undefined}>{c.deletedReason ?? '—'}</span>
      ),
    },
    {
      key: 'deletedAt', header: 'O‘chirilgan', align: 'right', sortable: true, sortValue: (c) => c.deletedAt ?? '',
      render: (c) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-error-50 px-1.5 py-0.5 text-xs font-medium text-error-600 dark:bg-error-500/10 dark:text-error-400">
          <Trash className="h-3.5 w-3.5" /> {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString('ru-RU') : '—'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (c) => (
        <Button
          variant="secondary"
          className="px-2.5 py-1.5 text-xs"
          loading={restore.isPending && restore.variables === c.id}
          onClick={(e) => { e.stopPropagation(); restore.mutate(c.id); }}
        >
          <Return className="h-4 w-4" /> Aktivlashtirish
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Arizalar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{isOperator ? 'Sizning kredit arizalaringiz' : 'Navbatingizdagi arizalar'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportExcel} loading={exporting} disabled={!cases?.length}>
            {!exporting && <FileSpreadsheet className="h-4 w-4" />} Excelga chiqarish
          </Button>
          {canCreate && (
            <Button onClick={() => nav('/cases/new')}><FilePlus2 className="h-4 w-4" /> Yangi ariza</Button>
          )}
        </div>
      </div>

      {/* Faol / Arxiv tabs — archived (soft-deleted) drafts live separately. */}
      <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
        {([['active', 'Faol'], ['archived', 'O‘chirilganlar']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition',
              tab === key ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'active' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats ? (
              <>
                <MetricCard className="cc-rise" icon={Layers} label="Jami ariza" value={String(stats.totalCases)} tone="brand" />
                <MetricCard className="cc-rise [animation-delay:60ms]" icon={FileCheck2} label="Yakunlangan" value={String(stats.finalizedCount)} tone="success" />
                <MetricCard className="cc-rise [animation-delay:120ms]" icon={Banknote} label="Jami summa" value={formatMoney(stats.totalAmount)} tone="warning" />
                <MetricCard className="cc-rise [animation-delay:180ms]" icon={Banknote} label="Jami KATM" value={formatMoney(stats.totalKatm)} tone="danger" />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">So‘nggi arizalar</h3>
            {isLoading ? (
              <Skeleton className="h-72 rounded-2xl" />
            ) : (
              <DataTable
                columns={activeColumns}
                rows={cases ?? []}
                searchable
                searchFields={['number', 'borrowerName', 'branchSymbol']}
                filter={filters.predicate}
                toolbar={filters.toolbar}
                onRowClick={(c) => nav(`/cases/${c.id}`)}
                empty="Hozircha ariza yo‘q"
              />
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">O‘chirilgan qoralamalar</h3>
          {archLoading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (
            <DataTable
              columns={archivedColumns}
              rows={archived ?? []}
              searchable
              searchFields={['number', 'borrowerName', 'createdByName']}
              onRowClick={(c) => nav(`/cases/${c.id}`)}
              empty="O‘chirilgan qoralama yo‘q"
            />
          )}
        </div>
      )}
    </div>
  );
}
