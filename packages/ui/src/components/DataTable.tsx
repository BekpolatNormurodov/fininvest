import { useMemo, useState } from 'react';
import { Search, ArrowRight, ChevronDown, Inbox } from '../lib/icons';
import { cn } from '../lib/cn';
import { surface } from '../lib/surfaces';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Enable click-to-sort on this column's header. */
  sortable?: boolean;
  /** Value used for sorting (defaults to row[key]); use for derived/formatted columns. */
  sortValue?: (row: T) => string | number;
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  pageSize = 8,
  onRowClick,
  searchable,
  searchFields,
  filter,
  toolbar,
  empty = 'Ma’lumot yo‘q',
}: {
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchFields?: (keyof T)[];
  /** Row predicate applied BEFORE the text search — the filter bar owns its own state and passes this. */
  filter?: (row: T) => boolean;
  /** Controls rendered on the search row, right of the input — the filter bar goes here. */
  toolbar?: React.ReactNode;
  empty?: string;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const filtered = useMemo(() => {
    const base = filter ? rows.filter(filter) : rows;
    if (!q || !searchFields) return base;
    const needle = q.toLowerCase();
    return base.filter((r) => searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(needle)));
  }, [rows, q, searchFields, filter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const val = (row: T) => (col.sortValue ? col.sortValue(row) : (row as any)[col.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'uz', { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  };

  return (
    <div className={cn('overflow-hidden', surface)}>
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-white/10">
          {searchable && (
            <div className="flex min-w-[180px] flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(0); }}
                placeholder="Qidirish…"
                aria-label="Jadvalda qidirish"
                className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
              {q && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-300">{filtered.length}</span>}
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}
      {/* Desktop / tablet: real table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    aria-sort={c.sortable ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                    className={cn('whitespace-nowrap px-4 py-3 font-medium', alignCls(c.align))}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          'group inline-flex cursor-pointer items-center gap-1 rounded transition-colors hover:text-gray-700 dark:hover:text-gray-200',
                          c.align === 'right' && 'flex-row-reverse',
                          active && 'text-gray-700 dark:text-gray-200',
                        )}
                      >
                        {c.header}
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 transition',
                            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
                            active && sort!.dir === 'asc' && 'rotate-180',
                          )}
                        />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5">
                      <Inbox className="h-6 w-6" />
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>
                  </div>
                </td>
              </tr>
            )}
            {slice.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-t border-gray-100 transition-colors first:border-0 dark:border-white/[0.06]',
                  onRowClick && 'cursor-pointer hover:bg-gray-50/60 dark:hover:bg-white/5',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 text-gray-700 dark:text-gray-200', alignCls(c.align), c.align === 'right' && 'nums', c.className)}>
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards (first column is the title, rest are label/value rows) */}
      <div className="divide-y divide-gray-100 sm:hidden dark:divide-white/[0.06]">
        {slice.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5">
              <Inbox className="h-6 w-6" />
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>
          </div>
        )}
        {slice.map((row, i) => {
          const [first, ...rest] = columns;
          const cell = (c: Column<T>) => (c.render ? c.render(row) : String((row as any)[c.key] ?? '—'));
          return (
            <div key={row.id ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('space-y-2 p-4', onRowClick && 'cursor-pointer active:bg-gray-50 dark:active:bg-white/5')}>
              <div className="font-medium text-gray-800 dark:text-gray-100">{cell(first)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {rest.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1 last:border-0 dark:border-white/[0.06]">
                    <dt className="shrink-0 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{c.header}</dt>
                    <dd className="min-w-0 truncate text-right text-gray-700 dark:text-gray-200">{cell(c)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm dark:border-white/10">
          <span className="text-gray-500 dark:text-gray-400">{filtered.length} ta · {safePage + 1}/{pageCount} sahifa</span>
          <div className="flex gap-1.5">
            <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 transition disabled:opacity-40 enabled:hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-white/5">
              <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Oldingi
            </button>
            <button disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 transition disabled:opacity-40 enabled:hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-white/5">
              Keyingi <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
