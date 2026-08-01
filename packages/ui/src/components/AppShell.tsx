import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Search, X, FileText } from '../lib/icons';
import { api, userAvatarUrl } from '@credit-core/api-client';
import { ROLE_LABEL, STATUS_LABEL } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { playPing } from '../lib/sound';
import { ConfirmDialog } from './Modal';
import { LangSwitch, ThemeSwitch } from './Switches';
import { LogoMark } from './Logo';

/** Global case search — by number, borrower, guarantor, operator or branch. */
function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const { data: results, isFetching } = useQuery({
    queryKey: ['case-search', q],
    queryFn: () => api.searchCases(q),
    enabled: q.trim().length >= 2,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (id: string) => { navigate(`/cases/${id}`); setOpen(false); setQ(''); };

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label="Ariza qidirish"
        placeholder="Ariza, arizachi, kafil, operator yoki filial…"
        className="h-10 w-[260px] rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 xl:w-[340px]"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 top-12 z-50 w-[340px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-pop dark:border-gray-700 dark:bg-gray-800 dark:ring-1 dark:ring-white/10 xl:w-[420px]">
          {isFetching && !results && <p className="px-4 py-3 text-sm text-gray-400">Qidirilmoqda…</p>}
          {results && results.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Hech narsa topilmadi</p>}
          <ul className="max-h-80 overflow-y-auto py-1">
            {results?.map((c) => (
              <li key={c.id}>
                <button onClick={() => go(c.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"><FileText className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">{c.number} <span className="font-normal text-gray-400">· {c.borrowerName ?? '—'}</span></span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{c.branchSymbol ?? '—'} · {STATUS_LABEL[c.status]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'unread';
  /** Uppercase section heading the item is grouped under in the sidebar. */
  section?: string;
}

/** Sidebar-panel glyph (not a directional arrow). The left strip fills when the
 *  panel is expanded, hollow when collapsed — conveys state without an L/R arrow. */
function PanelToggle({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="9" y1="4" x2="9" y2="20" />
      {open && <rect x="4.2" y="5.2" width="3.6" height="13.6" rx="1" fill="currentColor" stroke="none" opacity={0.22} />}
    </svg>
  );
}

export function AppShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false); // mobile off-canvas drawer
  const [collapsed, setCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('cc.sidebar.collapsed') === '1',
  ); // desktop rail (persisted)
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    localStorage.setItem('cc.sidebar.collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const { data: unread } = useQuery({ queryKey: ['unread'], queryFn: () => api.unreadCount(), refetchInterval: 20_000 });

  // Soft "ping" when new unread arrives (gated by the per-user sound preference).
  const prevUnread = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (unread === undefined) return;
    if (prevUnread.current !== undefined && unread > prevUnread.current) playPing();
    prevUnread.current = unread;
  }, [unread]);

  const current = nav.find((n) => n.to === location.pathname || (n.to !== '/' && location.pathname.startsWith(n.to)));

  // Group nav items by section (preserving order); undefined → "Menyu".
  const sections: { label: string; items: NavItem[] }[] = [];
  for (const item of nav) {
    const label = item.section ?? 'Menyu';
    const group = sections.find((s) => s.label === label);
    if (group) group.items.push(item);
    else sections.push({ label, items: [item] });
  }

  // Narrow icon-rail at xl when collapsed (pinned; toggled via the edge handle).
  const rail = collapsed;

  const navItem = (item: NavItem) => {
    const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
    const badge = item.badgeKey === 'unread' ? unread : 0;
    return (
      <Link
        key={item.to}
        to={item.to}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          rail && 'xl:justify-center xl:px-0',
          active
            ? 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100',
        )}
      >
        {active && (
          <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400" />
        )}
        <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-brand-700 dark:text-brand-400')} />
        <span className={cn('flex-1 truncate', rail && 'xl:hidden')}>{item.label}</span>
        {!!badge && badge > 0 && (
          <span className={cn(
            // A count badge is a circle for one digit and a pill for more — a fixed height with a
            // matching min-width and centred text, so a single «3» is round rather than squeezed
            // narrow. `leading-5` alone set the height but not the width, which made it an oval.
            'inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold leading-none text-white',
            rail && 'xl:hidden',
          )}>{badge > 99 ? '99+' : badge}</span>
        )}
        {rail && !!badge && badge > 0 && (
          <span className="absolute right-2 top-2 hidden h-2 w-2 rounded-full bg-error-500 xl:block" />
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Off-canvas backdrop (mobile / tablet) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm xl:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — fixed; off-canvas below xl, persistent rail at xl */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-gray-200 bg-white px-5 py-6 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900',
          'xl:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          rail ? 'xl:w-[90px] xl:px-3' : 'xl:w-[290px]',
        )}
      >
        {/* Logo */}
        <div className={cn('mb-7 flex shrink-0 items-center gap-2.5', rail && 'xl:justify-center')}>
          <LogoMark className="h-10 w-10 shrink-0" />
          <div className={cn('leading-tight', rail && 'xl:hidden')}>
            <p className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">Fin<span className="text-brand-700 dark:text-brand-400">Invest</span></p>
            <p className="text-xs text-gray-400">{user ? ROLE_LABEL[user.role] : ''}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Menyuni yopish"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 xl:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sectioned nav */}
        <div className="no-scrollbar -mr-2 min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
          {sections.map((s) => (
            <div key={s.label}>
              <p className={cn('mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400', rail && 'xl:hidden')}>{s.label}</p>
              <nav className="space-y-1">{s.items.map(navItem)}</nav>
            </div>
          ))}
        </div>

        {/* Footer: profile + logout */}
        <div className="mt-4 shrink-0 border-t border-gray-200 pt-4 dark:border-gray-800">
          <Link
            to="/profile"
            title={user?.fullName}
            className={cn('flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-100 dark:hover:bg-white/5', rail && 'xl:justify-center xl:p-1.5')}
          >
            {user?.hasAvatar ? (
              <img src={userAvatarUrl(user.id)} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
                {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className={cn('min-w-0', rail && 'xl:hidden')}>
              <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">{user?.fullName}</span>
              <span className="block truncate text-xs text-gray-400">{user?.branch?.name ?? 'Markaziy apparat'}</span>
            </span>
          </Link>
          <button
            onClick={() => setConfirmLogout(true)}
            title="Chiqish"
            className={cn(
              'mt-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5',
              rail && 'xl:justify-center xl:px-0',
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" /> <span className={cn(rail && 'xl:hidden')}>Chiqish</span>
          </button>
        </div>

        {/* Desktop collapse handle — sits centered on the sidebar's right border */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Yon panelni ochish' : 'Yon panelni yig‘ish'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Ochish' : 'Yig‘ish'}
          className={cn(
            'absolute right-0 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full',
            'border border-gray-200 bg-white text-gray-400 shadow-theme-sm transition duration-200',
            'hover:scale-110 hover:border-brand-300 hover:text-brand-700',
            'outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
            'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 dark:hover:border-brand-500/50 dark:hover:text-brand-400',
            'xl:flex',
          )}
        >
          <PanelToggle className="h-[15px] w-[15px]" open={!collapsed} />
        </button>
      </aside>

      {/* Content column, offset by the rail at xl */}
      <div className={cn('flex min-h-screen flex-col transition-all duration-300 ease-in-out', collapsed ? 'xl:ml-[90px]' : 'xl:ml-[290px]')}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-6">
          {/* mobile: open drawer */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 xl:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menyuni ochish"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h2 className="hidden text-base font-semibold text-gray-800 dark:text-white sm:block">{current?.label ?? title}</h2>

          {/* Global case search */}
          <GlobalSearch className="ml-1 hidden lg:block" />

          <div className="ml-auto flex items-center gap-2.5">
            <LangSwitch />
            <ThemeSwitch />
            <Link
              to="/notifications"
              aria-label="Bildirishnomalar"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <Bell className="h-5 w-5" />
              {!!unread && unread > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error-500 ring-2 ring-white dark:ring-gray-900" />
              )}
            </Link>
            <Link to="/profile" className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-gray-100 dark:hover:bg-white/5 sm:flex">
              {user?.hasAvatar ? (
                <img src={userAvatarUrl(user.id)} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
                  {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.fullName}</span>
            </Link>
          </div>
        </header>

        {/*
          Left-aligned, not centred. `mx-auto` centred the content inside whatever space the
          sidebar left over, so on anything wider than sidebar + 1536px a gap opened between the
          navigation and the page — 61px at 1900px wide, and growing with the display. The sidebar
          is pinned left; the page it drives has to start beside it, with only the padding between.

          The max-width stays: it caps line length on an ultra-wide monitor, it just no longer
          decides where the content begins.
        */}
        <main className="w-full max-w-[1536px] flex-1 p-4 md:p-6">
          <div key={location.pathname} className="cc-fade">{children}</div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={logout}
        tone="primary"
        title="Tizimdan chiqasizmi?"
        message="Joriy sessiya yakunlanadi va qaytadan login qilishingiz kerak bo'ladi."
        confirmLabel="Chiqish"
      />
    </div>
  );
}
