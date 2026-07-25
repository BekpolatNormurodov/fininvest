import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';
import '@fontsource/fira-code/700.css';
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { BarChart3, FilePlus2, LayoutGrid, Calculator, Messages, Building, UserAdd, Bell as BellIcon, Settings, RotateCcw, FileCheck } from './lib/icons';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { I18nProvider, useI18n } from './lib/i18n';
import { ToastProvider } from './components/Toast';
import { Splash } from './components/Splash';
import { LoginPage } from './components/LoginPage';
import { AppShell, type NavItem } from './components/AppShell';
import { Button } from './components/primitives';
import { Dashboard } from './pages/Dashboard';
import { CaseView } from './pages/CaseView';
import { CaseDocumentsPage } from './pages/CaseDocumentsPage';
import { CaseDisbursementPage } from './pages/CaseDisbursementPage';
import { OriginationWizard } from './pages/origination/OriginationWizard';
import { NewApplicationPage } from './pages/origination/NewApplicationPage';
import { ReMflPage } from './pages/ReMflPage';
import { DocCheckPage } from './pages/DocCheckPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { CreditCalculator } from './pages/CreditCalculator';
import { ChatsPage } from './pages/ChatsPage';
import { BranchesPage } from './pages/BranchesPage';
import { UsersPage } from './pages/UsersPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function navFor(role: Role, t: (k: string) => string): NavItem[] {
  const main = 'Asosiy';
  const base: NavItem[] = [{ to: '/', label: t('nav.applications'), icon: LayoutGrid, section: main }];
  if (role === Role.OPERATOR || role === Role.ADMIN) base.push({ to: '/cases/new', label: t('nav.new'), icon: FilePlus2, section: main });
  if (role === Role.OPERATOR || role === Role.ADMIN) base.push({ to: '/cases/re-mfl', label: 'Qayta MFL', icon: RotateCcw, section: main });
  if (role === Role.OPERATOR || role === Role.ADMIN) base.push({ to: '/hujjatlar', label: 'Hujjatlar tekshirish', icon: FileCheck, section: main });
  base.push({ to: '/calculator', label: t('nav.calculator'), icon: Calculator, section: main });
  base.push({ to: '/chats', label: t('nav.chats'), icon: Messages, badgeKey: 'unread', section: main });
  base.push({ to: '/analytics', label: t('nav.monitoring'), icon: BarChart3, section: main });
  base.push({ to: '/notifications', label: t('nav.notifications'), icon: BellIcon, badgeKey: 'unread', section: main });
  if (role === Role.ADMIN) {
    base.push({ to: '/branches', label: t('nav.branches'), icon: Building, section: 'Boshqaruv' });
    base.push({ to: '/users', label: t('nav.users'), icon: UserAdd, section: 'Boshqaruv' });
    base.push({ to: '/settings', label: t('nav.settings'), icon: Settings, section: 'Boshqaruv' });
  }
  return base;
}

function Shell({ role, title }: { role: Role; title: string }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  if (!user) return <LoginPage role={role} title={title} />;

  if (user.role !== role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">Bu portal "{ROLE_LABEL[role]}" uchun.</p>
        <p className="text-slate-500">Siz "{ROLE_LABEL[user.role]}" rolidasiz — to‘g‘ri portalga kiring.</p>
        <Button variant="secondary" onClick={logout}>Chiqish</Button>
      </div>
    );
  }

  return (
    <AppShell title={title} nav={navFor(role, t)}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {(role === Role.OPERATOR || role === Role.ADMIN) && <Route path="/cases/new" element={<NewApplicationPage />} />}
        {(role === Role.OPERATOR || role === Role.ADMIN) && <Route path="/cases/new/:product" element={<OriginationWizard />} />}
        {(role === Role.OPERATOR || role === Role.ADMIN) && <Route path="/cases/re-mfl" element={<ReMflPage />} />}
        {(role === Role.OPERATOR || role === Role.ADMIN) && <Route path="/hujjatlar" element={<DocCheckPage />} />}
        {(role === Role.OPERATOR || role === Role.ADMIN) && <Route path="/cases/:id/origination" element={<OriginationWizard />} />}
        <Route path="/cases/:id" element={<CaseView />} />
        <Route path="/cases/:id/hujjatlar" element={<CaseDocumentsPage />} />
        <Route path="/cases/:id/pul-otkazish" element={<CaseDisbursementPage />} />
        <Route path="/calculator" element={<CreditCalculator />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        {role === Role.ADMIN && <Route path="/branches" element={<BranchesPage />} />}
        {role === Role.ADMIN && <Route path="/users" element={<UsersPage />} />}
        {role === Role.ADMIN && <Route path="/settings" element={<SettingsPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function Gate({ role, title }: { role: Role; title: string }) {
  const { loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AnimatePresence>
        {(!splashDone || loading) && <Splash title={title} subtitle={`${ROLE_LABEL[role]} portali`} />}
      </AnimatePresence>
      {splashDone && !loading && <Shell role={role} title={title} />}
    </>
  );
}

export function RoleApp({ role, title }: { role: Role; title: string }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BrowserRouter>
                <Gate role={role} title={title} />
              </BrowserRouter>
            </AuthProvider>
          </QueryClientProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
