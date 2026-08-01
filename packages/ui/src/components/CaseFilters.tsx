import { useMemo, useRef, useState } from 'react';
import {
  LOAN_PRODUCT_ORDER, loanProductProfile, EMPTY_CASE_FILTER, activeFilterCount, matchesCaseFilter,
  datePreset, DATE_PRESET_ORDER, DATE_PRESET_LABELS,
  type LoanProduct, type CaseFilter, type CreditCaseListItem,
} from '@credit-core/shared';
import { Popover, DatePicker } from './forms';
import { Filter, ChevronDown, Check, X, Calendar } from '../lib/icons';
import { cn } from '../lib/cn';

/**
 * The applications-list filter bar.
 *
 * A hook, not a component, so the page owns nothing but the wiring: `useCaseFilters(rows)` returns
 * the toolbar to drop next to the table's search and the predicate to hand it. Every option except
 * the product list is derived from the rows themselves — the regions and branches that actually
 * occur — so the menus never offer a value that would match nothing, and they grow with the data
 * without a code change.
 *
 * The matching itself lives in shared (`matchesCaseFilter`), tested there; this file is only the
 * controls that build the CaseFilter state. All filtering is client-side: the list endpoint already
 * returns the whole role-scoped set, so narrowing it in the browser is instant and composes with the
 * table's existing search and sort.
 */
export function useCaseFilters(rows: CreditCaseListItem[], lang: 'uz' | 'ru') {
  const [s, setS] = useState<CaseFilter>(EMPTY_CASE_FILTER);

  // Regions and branches offered are the ones present in the data, sorted, blanks dropped.
  const regionOpts = useMemo(
    () => [...new Set(rows.map((r) => r.region).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'uz')),
    [rows],
  );
  const branchOpts = useMemo(
    () => [...new Set(rows.map((r) => r.branchName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'uz')),
    [rows],
  );

  const predicate = useMemo(() => (r: CreditCaseListItem) => matchesCaseFilter(s, r), [s]);
  const activeCount = activeFilterCount(s);

  const productOpts = LOAN_PRODUCT_ORDER.map((p) => ({ value: p as string, label: loanProductProfile(p).label[lang] }));

  const toolbar = (
    <>
      <FilterMenu
        label="Kredit turi" options={productOpts}
        selected={s.products as Set<string>} onChange={(products) => setS((x) => ({ ...x, products: products as Set<LoanProduct> }))}
      />
      <FilterMenu
        label="Sug‘urta"
        options={[{ value: 'yes', label: 'Sug‘urtali' }, { value: 'no', label: 'Sug‘urtasiz' }]}
        single selected={s.insured ? new Set([s.insured]) : new Set()}
        onChange={(set) => setS((x) => ({ ...x, insured: (set.values().next().value as 'yes' | 'no') ?? '' }))}
      />
      {/* Region and Filial are always shown — an empty menu says «Ma'lumot yo'q» rather than vanishing. */}
      <FilterMenu
        label="Region" options={regionOpts.map((v) => ({ value: v, label: v }))}
        selected={s.regions as Set<string>} onChange={(regions) => setS((x) => ({ ...x, regions }))}
      />
      <FilterMenu
        label="Filial" options={branchOpts.map((v) => ({ value: v, label: v }))}
        selected={s.branches as Set<string>} onChange={(branches) => setS((x) => ({ ...x, branches }))}
      />
      <DateRange from={s.from} to={s.to} onChange={(from, to) => setS((x) => ({ ...x, from, to }))} />
      {activeCount > 0 && (
        <button
          type="button" onClick={() => setS(EMPTY_CASE_FILTER)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-error-600 dark:text-gray-400 dark:hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" /> Tozalash
        </button>
      )}
    </>
  );

  return { toolbar, predicate, activeCount };
}

type Multi = Set<string>;

// ── a single dropdown chip ───────────────────────────────────────────────────

function chipCls(active: boolean): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
    active
      ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
  );
}

function FilterMenu({
  label, options, selected, onChange, single,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Multi;
  onChange: (next: Multi) => void;
  /** One value at a time — clicking the selected one clears it. */
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const active = selected.size > 0;

  const toggle = (v: string) => {
    if (single) { onChange(selected.has(v) ? new Set() : new Set([v])); setOpen(false); return; }
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  };

  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} className={chipCls(active)}>
        <Filter className="h-3.5 w-3.5" />
        {label}
        {active && (
          <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold leading-4 text-white">{selected.size}</span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={220}>
        <div className="max-h-72 overflow-y-auto p-1">
          {options.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-gray-400 dark:text-gray-500">Ma’lumot yo‘q</p>
          )}
          {options.map((o) => {
            const on = selected.has(o.value);
            return (
              <button
                key={o.value} type="button" onClick={() => toggle(o.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                  on ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'hover:bg-gray-100 dark:hover:bg-white/10',
                )}
              >
                <span className={cn(
                  'grid h-4 w-4 shrink-0 place-items-center rounded border',
                  on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 dark:border-gray-600',
                )}>{on && <Check className="h-3 w-3" />}</span>
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

// ── the date-range chip ──────────────────────────────────────────────────────

function DateRange({
  from, to, onChange,
}: { from: string | null; to: string | null; onChange: (from: string | null, to: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const active = !!(from || to);
  const short = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  const summary = active ? `${from ? short(from) : '…'} – ${to ? short(to) : '…'}` : 'Sana';

  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} className={chipCls(active)}>
        <Calendar className="h-3.5 w-3.5" />
        {summary}
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={256}>
        <div className="space-y-3 p-3">
          {/* Quick ranges — one tap sets Dan/Gacha; the pickers below still allow a custom span. */}
          <div className="grid grid-cols-2 gap-1.5">
            {DATE_PRESET_ORDER.map((key) => {
              const r = datePreset(key, new Date());
              const on = from === r.from && to === r.to;
              return (
                <button
                  key={key} type="button"
                  onClick={() => { onChange(r.from, r.to); setOpen(false); }}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-xs font-medium transition',
                    on
                      ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10',
                  )}
                >{DATE_PRESET_LABELS[key]}</button>
              );
            })}
          </div>
          <div className="h-px bg-gray-100 dark:bg-white/10" />
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
            Dan
            <div className="mt-1"><DatePicker value={from} onChange={(v) => onChange(v, to)} /></div>
          </label>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
            Gacha
            <div className="mt-1"><DatePicker value={to} onChange={(v) => onChange(from, v)} /></div>
          </label>
          {active && (
            <button
              type="button" onClick={() => onChange(null, null)}
              className="w-full rounded-lg px-2 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-error-600 dark:text-gray-400 dark:hover:bg-white/10"
            >Tozalash</button>
          )}
        </div>
      </Popover>
    </>
  );
}
