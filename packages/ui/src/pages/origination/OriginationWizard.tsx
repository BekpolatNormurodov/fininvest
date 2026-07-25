import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  type CaseSectionKey,
  type LoanProduct,
  LOAN_PRODUCT_PROFILES,
  loanProductProfile,
  LoanProductKind,
  termBandFor,
  TERM_BAND_LABEL,
} from '@credit-core/shared';
import { getErrorMessage } from '@credit-core/api-client';
import { Button } from '../../components/primitives';
import { useI18n } from '../../lib/i18n';
import { useToast } from '../../components/Toast';
import { Check } from '../../lib/icons';
import { cn } from '../../lib/cn';
import { useOriginationForm } from './useOriginationForm';
import { Step1, StepSugurta, StepGarov, StepParametrlar, StepIshKatm } from './steps';
import { Summary } from './Summary';

// Each step can persist more than one section (e.g. «Ish, daromad & KATM» saves employment AND
// creditHistory), so `sections` is a list the wizard loops over on save.
type WizardStep = { key: string; title: string; sections: CaseSectionKey[]; Comp: (p: { f: ReturnType<typeof useOriginationForm> }) => JSX.Element };

const BASE_STEPS: WizardStep[] = [
  { key: 'borrower', title: 'Qarz oluvchi', sections: ['borrower'], Comp: Step1 },
  { key: 'parametrlar', title: 'Kredit parametrlar', sections: ['creditLine'], Comp: StepParametrlar },
  { key: 'sugurta', title: 'Sug‘urta', sections: ['creditLine'], Comp: StepSugurta },
  { key: 'garov', title: 'Garov', sections: ['creditLine'], Comp: StepGarov },
  { key: 'ishkatm', title: 'Ish, daromad & KATM', sections: ['employment', 'creditHistory'], Comp: StepIshKatm },
];

export function OriginationWizard() {
  const { id, product } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { lang } = useI18n();
  const f = useOriginationForm(id);

  // Product from the picker route (/cases/new/:product) or, when editing, from the loaded case.
  const prod = product && product in LOAN_PRODUCT_PROFILES ? (product as LoanProduct) : null;
  const effProduct = prod ?? ((f.form.product ?? null) as LoanProduct | null);
  const isAsset = effProduct ? loanProductProfile(effProduct).kind === LoanProductKind.ASSET : false;
  // Asset products (AVTO/IPOTEKA) gain a final "Sotuvchi" step, and the pledge step is renamed to the
  // purchased asset — it is not a separate «garov». Appended (not inserted) so the index-keyed
  // per-step validation for the base steps stays aligned.
  const assetStepTitle = effProduct === 'AVTO' ? 'Mashina' : effProduct === 'IPOTEKA' ? 'Uy-joy' : 'Aktiv';
  const steps = useMemo<WizardStep[]>(() => {
    if (!isAsset) return BASE_STEPS;
    // Asset products lead with the purchased item (car/house) — that step also holds the down payment
    // and the seller, so there is no separate Sotuvchi step.
    const asset = { ...BASE_STEPS.find((s) => s.key === 'garov')!, title: assetStepTitle };
    const rest = BASE_STEPS.filter((s) => s.key !== 'garov');
    return [asset, ...rest];
  }, [isAsset, assetStepTitle]);
  const { Comp } = steps[f.step] ?? steps[0];
  const termM = f.form.creditLine?.termMonths ?? f.form.termMonths ?? null;
  const band = effProduct && termM ? termBandFor(termM) : null;

  // On a fresh application, stamp the chosen product onto the form so it is saved with the case.
  useEffect(() => {
    if (prod && !id) f.patch({ product: prod });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prod, id]);

  const next = async () => {
    if (f.stepHasErrors(steps[f.step].key)) { f.setAttempted(true); toast.error('Tekshiring', 'Majburiy maydonlarni to‘ldiring'); return; }
    try {
      for (const section of steps[f.step].sections) await f.saveSection(section);
      if (f.step < steps.length - 1) f.setStep(f.step + 1);
    } catch (err) {
      /*
        Show what the server actually said. It answers with the offending field — «insuredSum raqam
        bo'lishi kerak» — and this used to replace that with "try again", leaving the operator to
        hunt for a field the response had already named.
      */
      toast.error('Saqlanmadi', getErrorMessage(err));
    }
  };
  // Jumping between steps autosaves the current one (best-effort) so progress persists per step —
  // only once the case exists, to avoid creating empty drafts from stray clicks.
  const goTo = async (i: number) => {
    if (i === f.step) return;
    if (f.caseId) { try { for (const section of steps[f.step].sections) await f.saveSection(section); } catch { /* keep draft in memory */ } }
    f.setStep(i);
  };
  const finish = async () => {
    let s;
    try {
      s = await f.save();
    } catch (err) {
      toast.error('Saqlanmadi', getErrorMessage(err));
      return;
    }
    if (!s) { toast.error('Tekshiring', 'Majburiy maydonlar to‘ldirilmagan'); return; }
    toast.success('Saqlandi', s.number);
    nav(`/cases/${s.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{id ? 'Arizani to‘ldirish' : 'Yangi ariza'}</h1>
            {effProduct && (
              <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                {lang === 'ru' ? loanProductProfile(effProduct).label.ru : loanProductProfile(effProduct).label.uz}
                {band && (
                  <span className="ml-1.5 font-normal text-brand-600/80 dark:text-brand-400/80">
                    · {lang === 'ru' ? TERM_BAND_LABEL[band].ru : TERM_BAND_LABEL[band].uz}
                  </span>
                )}
              </span>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-400">Bosqich {f.step + 1}/{steps.length}</span>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Har bosqich alohida saqlanadi — istalgan vaqtda qaytib tuzatishingiz mumkin</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${((f.step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <ol className="flex flex-wrap gap-2">
            {steps.map((s, i) => {
              const current = i === f.step; // selected
              const complete = f.stepComplete(s.key); // has required fields AND all filled correctly
              const invalid = f.attempted && f.stepHasErrors(s.key); // touched (submit attempted), still missing a required field
              return (
                <li key={i}>
                  <button
                    onClick={() => goTo(i)}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                      current && 'ring-2 ring-brand-500/40', // selected — always visibly distinct
                      complete
                        ? 'border-success-300 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-400'
                        : invalid
                          ? 'border-error-300 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400'
                          : current
                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5',
                    )}
                  >
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                      complete ? 'bg-success-600 text-white' : invalid ? 'bg-error-600 text-white' : current ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    )}>
                      {complete ? <Check className="h-3 w-3" /> : invalid ? '!' : i + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
          <Comp f={f} />
          <div className="flex items-center justify-between">
            <Button variant="secondary" disabled={f.step === 0} onClick={() => f.setStep(f.step - 1)}>Orqaga</Button>
            {f.step < steps.length - 1
              ? <Button onClick={next} loading={f.saving}>Saqlash va davom</Button>
              : <Button onClick={finish} loading={f.saving}>Yakunlash</Button>}
          </div>
        </div>
        <aside><Summary form={f.form} /></aside>
      </div>
    </div>
  );
}
