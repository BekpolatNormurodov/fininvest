import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import { ArrowRight } from '../lib/icons';
import { Card, Skeleton, StatusBadge } from '../components/primitives';
import { DisbursementPanel } from './CaseView';

/**
 * Dedicated page for the disbursement bank requisites — «Пул ўтказиш аризаси». Reached from the
 * case view's «Pul o'tkazish» tile, so the requisites don't crowd the overview. The form itself is
 * the same `DisbursementPanel`, rendered in `standalone` mode (always expanded, no collapse).
 */
export function CaseDisbursementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: c, isLoading } = useQuery({ queryKey: ['case', id], queryFn: () => api.case(id!) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['case', id] });

  if (isLoading || !c) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Card><Skeleton className="h-64 w-full" /></Card>
      </div>
    );
  }

  const back = () => {
    const st = window.history.state as { idx?: number } | null;
    if (st && typeof st.idx === 'number' && st.idx > 0) navigate(-1);
    else navigate(`/cases/${c.id}`);
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-gray-500 outline-none transition hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
      >
        <ArrowRight className="h-4 w-4 rotate-180" /> Arizaga qaytish
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Pul o‘tkazish rekvizitlari</h1>
        <StatusBadge status={c.status} />
        <span className="nums text-sm text-gray-500 dark:text-gray-400">{c.contractNumber ?? c.number}</span>
      </div>

      <div className="max-w-2xl">
        <DisbursementPanel c={c} onChange={refresh} standalone />
      </div>
    </div>
  );
}
