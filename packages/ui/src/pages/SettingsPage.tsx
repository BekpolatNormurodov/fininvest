import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import { CaseStatus, DEADLINE_STEPS, STATUS_LABEL } from '@credit-core/shared';
import { Clock, Minus, Plus, Pause, Save } from '../lib/icons';
import { Button, Card, Field, Input, Skeleton, StatusBadge } from '../components/primitives';
import { Toggle } from '../components/Switches';
import { useToast } from '../components/Toast';
import { cn } from '../lib/cn';

/** Parse a numeric input value, treating empty/NaN as 0 (avoids NaN poisoning config). */
const num0 = (s: string): number => (s === '' || Number.isNaN(Number(s)) ? 0 : Number(s));

/** Numbered node tint per step (mirrors the status badge hue). */
const stepTone: Record<string, string> = {
  [CaseStatus.MODERATION]: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  [CaseStatus.DIRECTOR_REVIEW]: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  [CaseStatus.ADMIN_FINALIZE]: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
};

const stepDesc: Record<string, string> = {
  [CaseStatus.MODERATION]: 'Moderator hujjatlarni tekshiradi',
  [CaseStatus.DIRECTOR_REVIEW]: 'Direktor ko‘rib chiqadi va tasdiqlaydi',
  [CaseStatus.ADMIN_FINALIZE]: 'Administrator yakuniy rasmiylashtiradi',
};

/** −/＋ numeric stepper for business days (1–60). */
function DayStepper({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  const set = (v: number) => onChange(Math.max(1, Math.min(60, v)));
  const btn = 'grid h-full w-9 place-items-center text-gray-500 outline-none transition hover:bg-gray-50 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200';
  return (
    <div className={cn('inline-flex h-11 items-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800', disabled && 'opacity-50')}>
      <button type="button" disabled={disabled} aria-label={`${label}: kamaytirish`} className={cn(btn, 'rounded-l-lg')} onClick={() => set(value - 1)}><Minus className="h-4 w-4" /></button>
      <input
        type="number"
        min={1}
        max={60}
        disabled={disabled}
        value={value}
        aria-label={label}
        onChange={(e) => set(num0(e.target.value))}
        className="nums h-full w-11 border-x border-gray-200 bg-transparent text-center text-sm font-medium text-gray-800 outline-none [appearance:textfield] dark:border-gray-700 dark:text-gray-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" disabled={disabled} aria-label={`${label}: oshirish`} className={cn(btn, 'rounded-r-lg')} onClick={() => set(value + 1)}><Plus className="h-4 w-4" /></button>
    </div>
  );
}

type StepCfg = { businessDays: number; enabled: boolean };

/** Admin-only: system-wide SLA (business days) per workflow step, with per-step on/off. */
export function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['deadline-settings'], queryFn: () => api.getDeadlineSettings() });
  const [cfg, setCfg] = useState<Record<string, StepCfg>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, StepCfg> = {};
    data.forEach((s) => { next[s.step] = { businessDays: s.businessDays, enabled: s.enabled }; });
    setCfg(next);
  }, [data]);

  const patch = (step: string, p: Partial<StepCfg>) =>
    setCfg((c) => ({ ...c, [step]: { businessDays: c[step]?.businessDays ?? 2, enabled: c[step]?.enabled ?? true, ...p } }));

  const save = useMutation({
    mutationFn: () =>
      api.updateDeadlineSettings(
        DEADLINE_STEPS.map((step) => ({
          step,
          businessDays: Math.max(1, Math.min(60, Math.round(cfg[step]?.businessDays ?? 2))),
          enabled: cfg[step]?.enabled ?? true,
        })),
      ),
    onSuccess: (res) => {
      qc.setQueryData(['deadline-settings'], res);
      toast.success('Saqlandi', 'Bosqich muddatlari yangilandi');
    },
    onError: () => toast.error('Xatolik', 'Saqlab bo‘lmadi'),
  });

  // Global config (pause limit + loan rates). Percentages shown as whole numbers.
  const { data: appCfg } = useQuery({ queryKey: ['app-config'], queryFn: () => api.getConfig() });
  const [conf, setConf] = useState<{ maxPauseDays: number; markup: number; bank: number; tax: number; npl: number; min: number; max: number; dueDays: number } | null>(null);
  useEffect(() => {
    if (appCfg) setConf({
      maxPauseDays: appCfg.maxPauseDays,
      markup: Math.round(appCfg.markupPercent * 100),
      bank: Math.round(appCfg.bankRate * 100),
      tax: Math.round(appCfg.taxRate * 100),
      npl: Math.round(appCfg.nplRate * 100),
      min: Math.round(appCfg.minRate * 100),
      max: Math.round(appCfg.maxRate * 100),
      dueDays: appCfg.collectionDueDays,
    });
  }, [appCfg]);
  const saveConfig = useMutation({
    mutationFn: () => api.updateConfig({
      maxPauseDays: Math.max(0, Math.min(60, Math.round(conf!.maxPauseDays))),
      markupPercent: conf!.markup / 100, bankRate: conf!.bank / 100, taxRate: conf!.tax / 100, nplRate: conf!.npl / 100,
      minRate: conf!.min / 100, maxRate: conf!.max / 100,
      collectionDueDays: Math.max(1, Math.min(365, Math.round(conf!.dueDays))),
    }),
    onSuccess: (res) => { qc.setQueryData(['app-config'], res); toast.success('Saqlandi', 'Sozlamalar yangilandi'); },
    onError: () => toast.error('Xatolik', 'Saqlab bo‘lmadi'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Sozlamalar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Tizim bo‘yicha bosqich muddatlari (SLA)</p>
      </div>

      <Card className="max-w-2xl space-y-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
            <Clock className="h-[22px] w-[22px]" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">Bosqich muddatlari</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Har bir bosqich uchun ish kunlari soni (standart — 2). Muddat o‘tsa, mas‘ul xodim va direktorga bildirishnoma boradi. Timerni o‘chirsangiz — o‘sha bosqichda muddat ham, ogohlantirish ham bo‘lmaydi. Dam olish kunlari hisobga olinmaydi.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
        ) : (
          <ol className="relative">
            {DEADLINE_STEPS.map((step, i) => {
              const enabled = cfg[step]?.enabled ?? true;
              const last = i === DEADLINE_STEPS.length - 1;
              return (
                <li key={step} className="flex gap-4 pb-5 last:pb-0">
                  {/* Stepper rail */}
                  <div className="flex flex-col items-center">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold', stepTone[step])}>{i + 1}</span>
                    {!last && <span aria-hidden="true" className="mt-1 w-px flex-1 bg-gray-200 dark:bg-white/10" />}
                  </div>

                  {/* Step row */}
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-3 pb-0.5">
                    <div className="min-w-0">
                      <StatusBadge status={step} />
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{stepDesc[step]}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <DayStepper
                          value={cfg[step]?.businessDays ?? 2}
                          disabled={!enabled}
                          onChange={(v) => patch(step, { businessDays: v })}
                          label={`${STATUS_LABEL[step]} muddati`}
                        />
                        <span className={cn('text-sm text-gray-500 dark:text-gray-400', !enabled && 'opacity-50')}>ish kuni</span>
                      </div>
                      <Toggle checked={enabled} onChange={(v) => patch(step, { enabled: v })} label={`${STATUS_LABEL[step]} timeri`} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">O‘zgarishlar yangi va joriy arizalarga qo‘llanadi.</p>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={isLoading}>
            <Save className="h-5 w-5" /> Saqlash
          </Button>
        </div>
      </Card>

      <Card className="max-w-2xl space-y-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
            <Pause className="h-[22px] w-[22px]" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">Pauza va moliyaviy sozlamalar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Maksimal pauza muddati hamda kredit hisob-kitobida ishlatiladigan foiz stavkalari.</p>
          </div>
        </div>

        {!conf ? (
          <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Maksimal pauza (kun)" hint="ariza shu kundan ortiq pauzada tursa — avtomatik davom etadi">
              <Input type="number" min={0} max={60} value={conf.maxPauseDays} onChange={(e) => setConf({ ...conf, maxPauseDays: num0(e.target.value) })} className="nums" />
            </Field>
            <Field label="Undiruv muddati (kun)" hint="undiruvchiga beriladigan default max kun — har bir undiruvda o‘zgartirsa bo‘ladi">
              <Input type="number" min={1} max={365} value={conf.dueDays} onChange={(e) => setConf({ ...conf, dueDays: num0(e.target.value) })} className="nums" />
            </Field>
            <Field label="Klient ustama foizi (%)">
              <Input type="number" min={0} max={500} value={conf.markup} onChange={(e) => setConf({ ...conf, markup: num0(e.target.value) })} className="nums" />
            </Field>
            <Field label="Bank yillik stavkasi (%)">
              <Input type="number" min={0} max={500} value={conf.bank} onChange={(e) => setConf({ ...conf, bank: num0(e.target.value) })} className="nums" />
            </Field>
            <Field label="Min yillik foiz (%)" hint="standart 55 — kredit pastki chegarasi">
              <Input type="number" min={0} max={500} value={conf.min} onChange={(e) => setConf({ ...conf, min: num0(e.target.value) })} className="nums" />
            </Field>
            <Field label="Max yillik foiz (%)" hint="moderator shu gacha ko‘taradi">
              <Input type="number" min={0} max={500} value={conf.max} onChange={(e) => setConf({ ...conf, max: num0(e.target.value) })} className="nums" />
            </Field>
            <Field label="Daromad solig‘i (%)">
              <Input type="number" min={0} max={100} value={conf.tax} onChange={(e) => setConf({ ...conf, tax: num0(e.target.value) })} className="nums" />
            </Field>
            <Field label="NPL — to‘lanmaslik (%)">
              <Input type="number" min={0} max={100} value={conf.npl} onChange={(e) => setConf({ ...conf, npl: num0(e.target.value) })} className="nums" />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-white/10">
          {conf && conf.min > conf.max
            ? <p className="text-xs font-medium text-error-600 dark:text-error-500">Min foiz Max dan katta bo‘lmasligi kerak</p>
            : <span />}
          <Button onClick={() => saveConfig.mutate()} loading={saveConfig.isPending} disabled={!conf || conf.min > conf.max}>
            <Save className="h-5 w-5" /> Saqlash
          </Button>
        </div>
      </Card>
    </div>
  );
}
