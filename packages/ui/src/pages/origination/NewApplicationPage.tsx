import { useNavigate } from 'react-router-dom';
import { LOAN_PRODUCT_ORDER, loanProductProfile, type LoanProduct } from '@credit-core/shared';
import { useI18n } from '../../lib/i18n';
import { Banknote, Money, Car, Building, ArrowRight } from '../../lib/icons';

/** Icon + one-line hint per product, shown on the "new application" picker. */
const ICON: Record<LoanProduct, typeof Banknote> = {
  ADM_TEAM: Banknote,
  OSON: Money,
  AVTO: Car,
  IPOTEKA: Building,
};

const HINT: Record<LoanProduct, { uz: string; ru: string }> = {
  ADM_TEAM: { uz: 'Naqd — 36 oygacha', ru: 'Наличные — до 36 мес' },
  OSON: { uz: 'Naqd — tez, oson', ru: 'Наличные — быстро' },
  AVTO: { uz: 'Mashina — o‘zi garov', ru: 'Авто — залог сам автомобиль' },
  IPOTEKA: { uz: 'Uy-joy — o‘zi garov', ru: 'Жильё — залог сама недвижимость' },
};

/**
 * "Yangi ariza" landing — pick one of the four products before the wizard opens. The chosen
 * product is carried in the route (`/cases/new/:product`) so the wizard adapts to it.
 */
export function NewApplicationPage() {
  const nav = useNavigate();
  const { lang } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Yangi ariza</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {lang === 'ru' ? 'Выберите продукт' : 'Mahsulotni tanlang'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LOAN_PRODUCT_ORDER.map((p) => {
          const profile = loanProductProfile(p);
          const Icon = ICON[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => nav(`/cases/new/${p}`)}
              className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-left outline-none transition hover:border-brand-300 hover:shadow-pop focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/40"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-gray-800 dark:text-white">
                  {lang === 'ru' ? profile.label.ru : profile.label.uz}
                </div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {lang === 'ru' ? HINT[p].ru : HINT[p].uz}
                </div>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition group-hover:gap-2 dark:text-brand-400">
                {lang === 'ru' ? 'Начать' : 'Boshlash'} <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
