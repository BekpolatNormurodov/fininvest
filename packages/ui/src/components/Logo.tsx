/**
 * FinInvest brand mark — a gradient badge with a rising trend line + arrowhead
 * (financial growth / investment). Pure SVG, scales with className (h-/w-).
 * Use `Logo` for the text lockup.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="fi-logo" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#fi-logo)" />
      {/* baseline bars — the "invest" ascent */}
      <rect x="10.5" y="23.5" width="3.4" height="6" rx="1.2" fill="#fff" fillOpacity="0.45" />
      <rect x="18.3" y="20" width="3.4" height="9.5" rx="1.2" fill="#fff" fillOpacity="0.6" />
      <rect x="26.1" y="16" width="3.4" height="13.5" rx="1.2" fill="#fff" fillOpacity="0.75" />
      {/* rising trend line + arrowhead */}
      <path d="M11 24.5 L18 19 L23 22 L29.5 12.5" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24.8 12.6 L30 12 L29.4 17.2" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-10 w-10 shrink-0" />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">Fin<span className="text-brand-700 dark:text-brand-400">Invest</span></p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
