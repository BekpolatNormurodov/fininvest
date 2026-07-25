import { motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from './Logo';

/**
 * Brand splash — the first frame the user sees. Echoes the login stage
 * (ambient brand glows + masked dotted grid) so splash → login → app reads as
 * one continuous identity. The concentric ring (static track + spinning comet
 * arc) is an indeterminate loading signal: it stays graceful no matter how long
 * auth takes. Fully degrades under prefers-reduced-motion.
 */
export function Splash({ title, subtitle }: { title: string; subtitle: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={`${title} — yuklanmoqda`}
      aria-busy
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.03, filter: 'blur(4px)' }}
      transition={{ duration: reduce ? 0 : 0.4, ease: 'easeOut' }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-canvas dark:bg-gray-950"
    >
      {/* Ambient brand glows */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-brand-400/20 blur-[120px] dark:bg-brand-500/20" />
      <div className="pointer-events-none absolute -bottom-40 left-[22%] h-80 w-80 rounded-full bg-brand-700/10 blur-[120px] dark:bg-brand-500/20" />

      {/* Masked dotted grid (matches the login brand stage) */}
      <div
        className="pointer-events-none absolute inset-0 text-gray-900 opacity-[0.04] dark:text-white dark:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(60% 55% at 50% 42%, #000 30%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(60% 55% at 50% 42%, #000 30%, transparent 78%)',
        }}
      />

      {/* Logo tile inside a concentric brand spinner */}
      <div className="relative flex h-32 w-32 items-center justify-center">
        {/* Breathing halo */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-0 m-auto h-28 w-28 rounded-full bg-brand-500/25 blur-2xl"
            animate={{ opacity: [0.3, 0.65, 0.3], scale: [0.9, 1.08, 0.9] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Static track ring */}
        <div className="absolute inset-0 m-auto h-28 w-28 rounded-full border-2 border-gray-200/70 dark:border-white/10" />

        {/* Spinning comet arc (indeterminate loading) */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-0 m-auto h-28 w-28 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, transparent 200deg, rgba(56,189,248,0.18) 250deg, #38bdf8 330deg, #0369a1 360deg)',
              WebkitMask:
                'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Icon tile */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 13 }}
          className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-theme-md dark:border-white/10 dark:bg-gray-800"
        >
          <LogoMark className="h-12 w-12" />
        </motion.div>
      </div>

      {/* Wordmark */}
      <motion.h1
        initial={reduce ? { opacity: 1 } : { y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.18, duration: 0.4 }}
        className="mt-7 font-heading text-3xl font-bold tracking-tight text-gray-900 dark:text-white"
      >
        Fin<span className="text-brand-500 dark:text-brand-400">Invest</span>
      </motion.h1>

      {/* Subtitle (role portal) */}
      <motion.p
        initial={reduce ? { opacity: 1 } : { y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.3, duration: 0.4 }}
        className="mt-2 text-sm text-gray-500 dark:text-gray-400"
      >
        {subtitle}
      </motion.p>
    </motion.div>
  );
}
