import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn } from '../lib/icons';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { getErrorMessage } from '@credit-core/api-client';
import { useAuth } from '../lib/auth';
import { Button, Input, Field, PasswordInput } from './primitives';
import { LangSwitch, ThemeSwitch } from './Switches';
import { LogoMark } from './Logo';

export function LoginPage({ role, title }: { role: Role; title: string }) {
  const { login } = useAuth();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(loginName, password);
      if (user.role !== role) {
        setError(`Bu portal faqat "${ROLE_LABEL[role]}" uchun. Sizning rolingiz: ${ROLE_LABEL[user.role]}`);
      }
    } catch (err) {
      setError(getErrorMessage(err, { unauthorized: 'Login yoki parol noto‘g‘ri' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-canvas dark:bg-gray-950 lg:grid lg:grid-cols-2">
      {/* Top-right controls */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2.5">
        <LangSwitch />
        <ThemeSwitch />
      </div>

      {/* Left: clean static brand panel (lg+) — logo + tagline, no 3D scene */}
      <div className="relative hidden overflow-hidden bg-gray-900 lg:flex lg:items-center lg:justify-center">
        {/* subtle dotted grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(75% 75% at 50% 45%, #000 30%, transparent 82%)',
            WebkitMaskImage: 'radial-gradient(75% 75% at 50% 45%, #000 30%, transparent 82%)',
          }}
        />
        {/* ambient corner glows */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-brand-700/20 blur-3xl" />

        {/* centered logo + tagline */}
        <div className="relative z-[2] px-12 text-center">
          <div className="flex items-center justify-center gap-3">
            <LogoMark className="h-14 w-14" />
            <span className="font-heading text-3xl font-bold tracking-tight text-white">Fin<span className="text-sky-300">Invest</span></span>
          </div>
          <h2 className="mt-9 font-heading text-2xl font-semibold text-white">Moliyaviy yechimlar — yagona panelda.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-300">
            Arizalar, moderatsiya, tahlil va hisobotlar — bitta xavfsiz boshqaruv tizimida.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo (panel hidden on small screens) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-12 w-12" />
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{ROLE_LABEL[role]} portali</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Tizimga kirish</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {ROLE_LABEL[role]} portali — login va parolingizni kiriting.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Login">
              <Input name="username" autoComplete="username" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="login" autoFocus />
            </Field>
            <Field label="Parol">
              <PasswordInput name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </Field>
            {error && (
              <p role="alert" className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {!loading && <LogIn className="h-4 w-4" />}
              {loading ? 'Kirilmoqda…' : 'Kirish'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">FinInvest • moliyaviy tizim</p>
        </motion.div>
      </div>
    </div>
  );
}
