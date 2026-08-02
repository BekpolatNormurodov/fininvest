import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collectionTotal,
  type CollectionDto,
  type CollectionMonthInput,
  type CollectorRef,
} from '@credit-core/shared';
import { api, getErrorMessage } from '@credit-core/api-client';
import { Modal } from './Modal';
import { Button, Field } from './primitives';
import { MoneyInput, Select } from './forms';
import { useToast } from './Toast';
import { cn, formatMoney } from '../lib/cn';

const MONTH_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

interface MonthOpt {
  year: number;
  month: number;
  key: string;
  label: string;
}

/** The last `count` months (current first), plus any extra months already on the collection. */
function monthOptions(count: number, extra: { year: number; month: number }[]): MonthOpt[] {
  const now = new Date();
  const map = new Map<string, MonthOpt>();
  const add = (y: number, m: number) => {
    const key = monthKey(y, m);
    if (!map.has(key)) map.set(key, { year: y, month: m, key, label: `${MONTH_UZ[m - 1]} ${y}` });
  };
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    add(d.getFullYear(), d.getMonth() + 1);
  }
  for (const e of extra) add(e.year, e.month);
  return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

/**
 * Create or edit an undiruv (collection) for one case: pick the unpaid months (each pre-filled with
 * the standard monthly payment, then editable), add penya + shtraf, and optionally assign a
 * collector. The total is computed live from the same shared function the server stores.
 */
export function CollectionForm({
  open,
  onClose,
  caseId,
  caseLabel,
  defaultMonthly = 0,
  collection,
  collectors,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseLabel: string;
  /** Standard monthly payment — pre-fills each newly selected month. */
  defaultMonthly?: number;
  /** When present, the form edits this collection instead of creating one. */
  collection?: CollectionDto | null;
  collectors: CollectorRef[];
  onSaved?: () => void;
}) {
  const editing = !!collection;
  const toast = useToast();
  const qc = useQueryClient();

  // The case's payment schedule (grafik) — each unpaid month pre-fills from its scheduled payment.
  const { data: schedule } = useQuery({
    queryKey: ['caseSchedule', caseId],
    queryFn: () => api.caseSchedule(caseId),
    enabled: open && !!caseId,
    staleTime: 5 * 60 * 1000,
  });
  const scheduleMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of schedule ?? []) m.set(monthKey(r.year, r.month), Math.round(r.total));
    return m;
  }, [schedule]);
  // A representative monthly payment for the «default» field — a middle schedule row (row 1 and the
  // last row can differ), falling back to the prop.
  const scheduleMonthly = useMemo(() => {
    const rows = schedule ?? [];
    if (!rows.length) return 0;
    return Math.round(rows[Math.min(1, rows.length - 1)].total);
  }, [schedule]);

  const [monthly, setMonthly] = useState<number>(
    collection?.months.length ? Math.round(collection.months.reduce((s, m) => s + m.amount, 0) / collection.months.length) : defaultMonthly,
  );
  // Once the schedule loads, adopt its monthly as the default (unless the user already set one).
  const [monthlyTouched, setMonthlyTouched] = useState(false);
  useEffect(() => {
    if (!editing && !monthlyTouched && scheduleMonthly > 0) setMonthly(scheduleMonthly);
  }, [editing, monthlyTouched, scheduleMonthly]);

  // Selected months → amount.
  const [amounts, setAmounts] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const m of collection?.months ?? []) seed[monthKey(m.year, m.month)] = m.amount;
    return seed;
  });
  const [penalty, setPenalty] = useState<number>(collection?.penalty ?? 0);
  const [fine, setFine] = useState<number>(collection?.fine ?? 0);
  const [note, setNote] = useState<string>(collection?.note ?? '');
  const [collectorId, setCollectorId] = useState<string>(collection?.collector?.id ?? '');

  const options = useMemo(
    () => monthOptions(12, (collection?.months ?? []).map((m) => ({ year: m.year, month: m.month }))),
    [collection],
  );

  const toggle = (o: MonthOpt) =>
    setAmounts((prev) => {
      const next = { ...prev };
      if (o.key in next) delete next[o.key];
      // The month's own scheduled payment wins; fall back to the default monthly.
      else next[o.key] = scheduleMap.get(o.key) ?? monthly ?? 0;
      return next;
    });

  const months: CollectionMonthInput[] = options
    .filter((o) => o.key in amounts)
    .map((o) => ({ year: o.year, month: o.month, amount: amounts[o.key] || 0 }));

  const total = collectionTotal({ months, penalty, fine });

  const save = useMutation({
    mutationFn: async () => {
      if (!months.length) throw new Error('Kamida bitta oy tanlang');
      if (editing) {
        return api.updateCollection(collection!.id, {
          months,
          penalty,
          fine,
          note: note || null,
          assignedCollectorId: collectorId || null,
        });
      }
      return api.createCollection({
        caseId,
        months,
        penalty,
        fine,
        note: note || null,
        assignedCollectorId: collectorId || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['collection', caseId] });
      toast.success(editing ? 'Saqlandi' : 'Undiruv yaratildi', caseLabel);
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error('Xatolik', getErrorMessage(e)),
  });

  const collectorOpts = collectors.map((c) => ({ value: c.id, label: c.fullName }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Undiruvni tahrirlash' : 'Undiruvga qo‘yish'}
      description={caseLabel}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Jami: <b className="nums text-gray-800 dark:text-white">{formatMoney(total)}</b>
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Bekor</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!months.length}>
              {editing ? 'Saqlash' : 'Yaratish'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Oylik to‘lov (default)" hint="Grafikdan olinadi — tanlangan oy shu summa bilan to‘ldiriladi">
          <MoneyInput value={monthly} onChange={(v) => { setMonthly(v ?? 0); setMonthlyTouched(true); }} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">To‘lanmagan oylar</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = o.key in amounts;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => toggle(o)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                    on
                      ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {months.length > 0 && (
            <div className="mt-3 space-y-2">
              {options
                .filter((o) => o.key in amounts)
                .map((o) => (
                  <div key={o.key} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-gray-600 dark:text-gray-300">{o.label}</span>
                    <div className="flex-1">
                      <MoneyInput
                        value={amounts[o.key] ?? 0}
                        onChange={(v) => setAmounts((prev) => ({ ...prev, [o.key]: v ?? 0 }))}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Penya">
            <MoneyInput value={penalty} onChange={(v) => setPenalty(v ?? 0)} />
          </Field>
          <Field label="Shtraf">
            <MoneyInput value={fine} onChange={(v) => setFine(v ?? 0)} />
          </Field>
        </div>

        <Field label="Undiruvchi" hint="Ixtiyoriy — keyin ham biriktirish mumkin">
          <Select
            value={collectorId}
            onChange={(v) => setCollectorId(v)}
            options={collectorOpts}
            placeholder="Biriktirilmagan"
            searchable
          />
        </Field>

        <Field label="Izoh">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ixtiyoriy izoh…"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-gray-100"
          />
        </Field>
      </div>
    </Modal>
  );
}
