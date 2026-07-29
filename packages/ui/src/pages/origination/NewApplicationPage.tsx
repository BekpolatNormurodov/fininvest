import { useNavigate } from 'react-router-dom';
import {
  LOAN_PRODUCT_ORDER,
  loanProductProfile,
  LoanProductKind,
  coverageTargetFor,
  type LoanProduct,
} from '@credit-core/shared';
import { useI18n } from '../../lib/i18n';
import { cn } from '../../lib/cn';
import { Banknote, Money, Car, Building, ArrowRight } from '../../lib/icons';

const ICON: Record<LoanProduct, typeof Banknote> = {
  ADM_TEAM: Banknote,
  OSON: Money,
  AVTO: Car,
  IPOTEKA: Building,
};

const HINT: Record<LoanProduct, { uz: string; ru: string }> = {
  ADM_TEAM: { uz: 'Naqd mikroqarz', ru: 'Наличный микрозаём' },
  OSON: { uz: 'Tez, oson naqd', ru: 'Быстрый наличный' },
  AVTO: { uz: 'Mashina xaridi', ru: 'Покупка авто' },
  IPOTEKA: { uz: 'Uy-joy xaridi', ru: 'Покупка жилья' },
};

// The cash products' cover is read from the product, not typed here: they stopped sharing a
// multiple (ADM TEAM 140%, OSON 125%), and a card promising 140% beside a wizard asking 125% is
// the kind of mismatch an operator quotes to a client.
const COLLATERAL: Record<LoanProduct, { uz: string; ru: string }> = {
  ADM_TEAM: { uz: 'Alohida garov', ru: 'Отдельный залог' },
  OSON: { uz: 'Alohida garov', ru: 'Отдельный залог' },
  AVTO: { uz: 'Mashina — o‘zi garov', ru: 'Авто — сам залог' },
  IPOTEKA: { uz: 'Uy-joy — o‘zi garov', ru: 'Жильё — сам залог' },
};

const INSURANCE: Record<string, { uz: string; ru: string }> = {
  LOAN_RISK: { uz: 'Qarz xavfi', ru: 'Риск невозврата' },
  CAR: { uz: 'KASKO', ru: 'КАСКО' },
  PROPERTY: { uz: 'Mulk sug‘urtasi', ru: 'Страхование имущества' },
};

/**
 * "Yangi ariza" landing — pick one of the four products. Each card summarises the product's real
 * terms (rate, term, down payment, collateral, insurance) from its profile, so the operator chooses
 * with the facts in front of them. The chosen product is carried into the wizard route.
 */
export function NewApplicationPage() {
  const nav = useNavigate();
  const { lang } = useI18n();
  const tr = (o: { uz: string; ru: string }) => (lang === 'ru' ? o.ru : o.uz);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Yangi ariza</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {lang === 'ru' ? 'Выберите кредитный продукт' : 'Kredit turini tanlang'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LOAN_PRODUCT_ORDER.map((p) => {
          const profile = loanProductProfile(p);
          const Icon = ICON[p];
          const isAsset = profile.kind === LoanProductKind.ASSET;
          /*
            Which end of its band a product opens at is what the card says. OSON is sold «up to
            50%» and starts at its ceiling, so it reads «50%gacha»; the rest quote a floor and read
            «32%dan». Derived, not written per product — the phrasing used to be hard-coded against
            the product name and would have gone stale the moment a rate moved.
          */
          const isCeiling = profile.rateDefaultPct === profile.rateMaxPct;
          const rateText = isCeiling
            ? `${profile.rateMaxPct}%${lang === 'ru' ? ' макс' : 'gacha'}`
            : `${profile.rateDefaultPct}%${lang === 'ru' ? '+' : 'dan'}`;
          const coverPct = Math.round(coverageTargetFor(p) * 100);
          const facts: { label: string; value: string }[] = [
            { label: lang === 'ru' ? 'Ставка' : 'Foiz', value: rateText },
            { label: lang === 'ru' ? 'Срок' : 'Muddat', value: `${profile.maxTermMonths} ${lang === 'ru' ? 'мес' : 'oygacha'}` },
            ...(isAsset
              ? [{ label: lang === 'ru' ? 'Взнос' : 'Boshlang‘ich', value: `${Math.round(profile.minDownPayment * 100)}%${lang === 'ru' ? '' : 'dan'}` }]
              : []),
            { label: lang === 'ru' ? 'Залог' : 'Garov', value: isAsset ? tr(COLLATERAL[p]) : `${tr(COLLATERAL[p])} (≥${coverPct}%)` },
            { label: lang === 'ru' ? 'Страховка' : 'Sug‘urta', value: tr(INSURANCE[profile.insurance]) },
          ];
          // Warm accent for asset products, brand (cool) for cash — a quiet visual split.
          const tile = isAsset
            ? 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
            : 'bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/20';
          const badge = isAsset
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
            : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400';
          return (
            <button
              key={p}
              type="button"
              onClick={() => nav(`/cases/new/${p}`)}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-left outline-none transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-pop focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/40"
            >
              {/* Top accent bar — reveals on hover */}
              <span aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100', isAsset ? 'bg-amber-400' : 'bg-brand-500')} />

              <div className="flex items-start justify-between gap-2">
                <span className={cn('grid h-12 w-12 place-items-center rounded-xl ring-1 transition group-hover:scale-105', tile)}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', badge)}>
                  {isAsset ? (lang === 'ru' ? 'Актив' : 'Aktiv') : (lang === 'ru' ? 'Наличные' : 'Naqd')}
                </span>
              </div>

              <div>
                <div className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{tr(profile.label)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{tr(HINT[p])}</div>
              </div>

              <dl className="space-y-2 border-t border-gray-100 pt-3 dark:border-white/10">
                {facts.map((fct) => (
                  <div key={fct.label} className="flex items-center justify-between gap-2 text-xs">
                    <dt className="text-gray-400 dark:text-gray-500">{fct.label}</dt>
                    <dd className="nums font-semibold text-gray-800 dark:text-gray-100">{fct.value}</dd>
                  </div>
                ))}
              </dl>

              <span className={cn('mt-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition group-hover:gap-2.5',
                isAsset ? 'bg-amber-50 text-amber-700 group-hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400'
                        : 'bg-brand-50 text-brand-700 group-hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400')}>
                {lang === 'ru' ? 'Начать' : 'Boshlash'} <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
