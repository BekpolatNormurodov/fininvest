import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import {
  SECTOR_RISK, SECTOR_OTHER, SECTOR_OTHER_RU, sectorRiskCode, loanTypeFor, originationCalc, ProductType,
  NATIONALITY_OPTIONS, MICRO_THRESHOLD, INSURANCE_COMPANIES, RELATIVE_RELATIONS, ENTREPRENEUR_TYPES,
  INSURANCE_MAX_MONTHS, INSURANCE_GEN_PREFIX, COLLATERAL_COVERAGE_TARGET, LINE_TERM_CAP, insurancePremiumRate,
  collateralComplete, collateralErrors,
  monthlyPaymentFor, termCapFor, isTermValid, paymentDayFor, DocumentType, type RepaymentMethod,
  type UpsertCasePayload,
  loanProductProfile, SellerKind, type LoanProduct,
} from '@credit-core/shared';
import { Button, Card, Field, Input } from '../../components/primitives';
import { MoneyInput, DatePicker, PhoneInput, Select } from '../../components/forms';
import { Toggle } from '../../components/Switches';
import { ConfirmDialog } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n';
import { House, Car, Plus, Trash, Check } from '../../lib/icons';
import { cn, formatMoney } from '../../lib/cn';
import { CollateralCard } from '../CaseForm';
import { PassportScan } from './PassportScan';
import { CollateralAttachments, saveCollateralMedia } from './CollateralMediaUpload';
import { TexScan } from './TexScan';
import type { OriginationForm } from './useOriginationForm';

const numv = (s: string): number | null => (s === '' ? null : Number(s));
const opt = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));

type Borrower = UpsertCasePayload['borrower'];
type Emp = NonNullable<UpsertCasePayload['employment']>;
type Aff = NonNullable<UpsertCasePayload['affordability']>;
type Line = NonNullable<UpsertCasePayload['creditLine']>;
type Tr = NonNullable<NonNullable<UpsertCasePayload['creditLine']>['tranche']>;
type Ins = NonNullable<NonNullable<UpsertCasePayload['creditLine']>['insurance']>;
type Hist = NonNullable<UpsertCasePayload['creditHistory']>;

/** Step 1 — Qarz oluvchi: identity + demographics. */
export function Step1({ f }: { f: OriginationForm }) {
  const b = f.form.borrower;
  const toast = useToast();
  const set = (p: Partial<Borrower>) => f.setBorrower(p);
  // Persist the scanned passport/ID image(s) as PASSPORT case documents, titled with the passport
  // number — they show up in the case's passport section. Best-effort: never blocks the scan.
  const saveScan = async (files: File[], passportNumber: string) => {
    try {
      const id = await f.ensureCase();
      if (!id) return;
      for (const file of files) {
        await api.uploadDocument(id, DocumentType.PASSPORT, file, { title: passportNumber ? `Passport ${passportNumber}` : 'Passport' });
      }
      toast.success('Saqlandi', 'Passport fayllari biriktirildi');
    } catch { /* best-effort — the scanned fields are already applied */ }
  };
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-gray-800 dark:text-white">Qarz oluvchi</h2>
      <PassportScan
        onExtract={(x) => {
          const { nationality, ...rest } = x;
          set({ ...rest, ...(nationality ? { citizenship: nationality } : {}) } as Partial<Borrower>);
        }}
        onSaveScan={saveScan}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="F.I.O" required error={f.attempted ? f.errors.fullName : undefined}><Input value={b.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
        <Field label="PINFL" required error={f.attempted ? f.errors.pinfl : undefined}><Input inputMode="numeric" maxLength={14} value={b.pinfl ?? ''} onChange={(e) => set({ pinfl: e.target.value.replace(/\D/g, '').slice(0, 14) })} /></Field>
        <Field label="INN (STIR)"><Input value={b.inn ?? ''} onChange={(e) => set({ inn: e.target.value })} /></Field>
        <Field label="Pasport seriya" required error={f.attempted ? f.errors.passportSeries : undefined}><Input maxLength={2} value={b.passportSeries ?? ''} onChange={(e) => set({ passportSeries: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} placeholder="AA" /></Field>
        <Field label="Pasport raqami" required error={f.attempted ? f.errors.passportNumber : undefined}><Input inputMode="numeric" maxLength={7} value={b.passportNumber ?? ''} onChange={(e) => set({ passportNumber: e.target.value.replace(/\D/g, '').slice(0, 7) })} /></Field>
        <Field label="Jinsi"><Select value={(b.gender ?? '') as 'MALE' | 'FEMALE' | ''} onChange={(v) => set({ gender: v })} options={[{ value: 'MALE', label: 'Erkak' }, { value: 'FEMALE', label: 'Ayol' }]} /></Field>
        <Field label="Fuqarolik"><Select searchable value={(b.citizenship ?? '') as string} onChange={(v) => set({ citizenship: v })} options={opt(NATIONALITY_OPTIONS)} /></Field>
        <Field label="Tug‘ilgan joy"><Input value={b.placeOfBirth ?? ''} onChange={(e) => set({ placeOfBirth: e.target.value })} /></Field>
        <Field label="Tug‘ilgan sana"><DatePicker value={b.birthDate ?? null} onChange={(iso) => set({ birthDate: iso })} /></Field>
        <Field label="Avvalgi F.I.O"><Input value={b.previousName ?? ''} onChange={(e) => set({ previousName: e.target.value })} placeholder="yo‘q" /></Field>
        <Field label="Pasport kim bergan"><Input value={b.passportIssuer ?? ''} onChange={(e) => set({ passportIssuer: e.target.value })} /></Field>
        <Field label="Berilgan sana"><DatePicker value={b.passportIssueDate ?? null} onChange={(iso) => set({ passportIssueDate: iso })} /></Field>
        <Field label="Amal qilish muddati"><DatePicker value={b.passportExpiry ?? null} onChange={(iso) => set({ passportExpiry: iso })} /></Field>
        <Field label="Telefon" required error={f.attempted ? f.errors.phone : undefined}><PhoneInput value={b.phone ?? null} onChange={(v) => set({ phone: v })} /></Field>
        <Field label="Oilaviy holat"><Select value={(b.maritalStatus ?? '') as string} onChange={(v) => set({ maritalStatus: v })} options={opt(['турмуш курган', 'ажрашган', 'бўйдоқ', 'бева'])} /></Field>
        <Field label="Oila a'zolari soni"><Input type="number" value={b.familySize ?? ''} onChange={(e) => set({ familySize: numv(e.target.value) })} /></Field>
        <Field label="Bolalar soni"><Input type="number" value={b.childrenCount ?? ''} onChange={(e) => set({ childrenCount: numv(e.target.value) })} /></Field>
        <Field label="Ma'lumoti"><Select value={(b.education ?? '') as string} onChange={(v) => set({ education: v })} options={opt(['бир нечта олий', 'олий', 'урта махсус', 'урта'])} /></Field>
        <Field label="Yashash davomiyligi">
          {/* `regTenure` is the column the anketa and the score read; `residenceDuration` was a
              second one for the same answer, so what the operator picked reached neither. */}
          <Select value={(b.regTenure ?? b.residenceDuration ?? '') as string} onChange={(v) => set({ regTenure: v, residenceDuration: v })} options={opt(['до 3 лет', '1-5 лет', '5-10 лет', 'иное'])} />
        </Field>
        <Field label="Uy egaligi"><Select value={(b.ownsHome ?? '') as string} onChange={(v) => set({ ownsHome: v })} options={opt(['мулкий хукук', 'ижара/ётокхона', 'иш берувчи берган'])} /></Field>
        <Field label="Depozit darajasi"><Select value={(b.depositsBand ?? '') as string} onChange={(v) => set({ depositsBand: v })} options={opt(['мавжуд эмас', '500$ кам', '500-1000$', '1000-3000$', '3000$+'])} /></Field>
      </div>
      <div className="grid gap-4 border-t border-gray-200 pt-4 dark:border-gray-800 sm:grid-cols-2">
        <Field label="Propiska manzili"><Input value={b.regAddress ?? ''} onChange={(e) => set({ regAddress: e.target.value })} /></Field>
        <Field label="Propiska orientiri"><Input value={b.regLandmark ?? ''} onChange={(e) => set({ regLandmark: e.target.value })} /></Field>
        <Field label="Faktik manzil"><Input value={b.actualAddress ?? ''} onChange={(e) => set({ actualAddress: e.target.value })} /></Field>
        <Field label="Faktik orientir"><Input value={b.actualLandmark ?? ''} onChange={(e) => set({ actualLandmark: e.target.value })} /></Field>
      </div>

      <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white">Yaqin kishilar</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Kamida 2 ta (5 tagacha) — munosabat, F.I.O va telefon</p>
          </div>
          <Button variant="secondary" disabled={(b.closeContacts?.length ?? 0) >= 5} onClick={f.addContact}><Plus className="h-4 w-4" /> Qo‘shish</Button>
        </div>
        {(b.closeContacts ?? []).map((c, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_1.2fr_auto]">
            <Field label={i === 0 ? 'Munosabat' : undefined}><Select value={(c.relation ?? '') as string} onChange={(v) => f.setContact(i, { relation: v })} options={opt([...RELATIVE_RELATIONS])} /></Field>
            <Field label={i === 0 ? 'F.I.O' : undefined}><Input value={c.fullName ?? ''} onChange={(e) => f.setContact(i, { fullName: e.target.value })} /></Field>
            <Field label={i === 0 ? 'Telefon' : undefined}><PhoneInput value={c.phone ?? null} onChange={(v) => f.setContact(i, { phone: v })} /></Field>
            <Button variant="ghost" disabled={(b.closeContacts?.length ?? 0) <= 2} onClick={() => f.removeContact(i)} aria-label="O‘chirish"><Trash className="h-4 w-4" /></Button>
          </div>
        ))}
        {f.attempted && f.errors.contacts && <p className="text-xs font-medium text-error-600 dark:text-error-500">{f.errors.contacts}</p>}
      </div>
    </Card>
  );
}

/** Step 2 — Ish & daromad: employment + actual income/expense. */
export function Step2({ f }: { f: OriginationForm }) {
  const { lang } = useI18n();
  const e = f.form.employment ?? ({} as Emp);
  const a = f.form.affordability ?? ({} as Aff);
  const setEmp = (p: Partial<Emp>) => f.patch({ employment: { ...e, ...p } as Emp });
  const setAff = (p: Partial<Aff>) => f.patch({ affordability: { ...a, ...p } as Aff });
  const amountTotal = f.form.creditLine?.amountTotal ?? f.form.amount ?? 0;
  const bigLoan = amountTotal > MICRO_THRESHOLD;
  return (
    <div className="space-y-6">
      <div className={cn('rounded-lg border px-3 py-2 text-sm', bigLoan
        ? 'border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400'
        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300')}>
        {bigLoan
          ? '100 mln+ — ish joyi va asosiy daromad MAJBURIY. To‘ldirilmasa ariza yakunlanmaydi.'
          : '100 mln gacha — bu bo‘lim shart emas (ixtiyoriy). Xohlasangiz to‘ldiring.'}
      </div>
      {bigLoan && (
        <Card className="space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-white">Tadbirkorlik guvohnomasi <span className="text-gray-500 dark:text-gray-400">(100 mln+)</span></h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guvohnoma turi"><Select value={(f.form.borrower.entrepreneurType ?? '') as string} onChange={(v) => f.setBorrower({ entrepreneurType: v })} options={opt([...ENTREPRENEUR_TYPES])} /></Field>
            <Field label="Guvohnoma raqami"><Input value={f.form.borrower.entrepreneurCertNo ?? ''} onChange={(e) => f.setBorrower({ entrepreneurCertNo: e.target.value })} /></Field>
          </div>
        </Card>
      )}
      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-white">Ish joyi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ish joyi" required={bigLoan} error={bigLoan && f.attempted && !e.employer?.trim() ? 'Majburiy' : undefined}><Input value={e.employer ?? ''} onChange={(ev) => setEmp({ employer: ev.target.value })} /></Field>
          <Field label="Ish joyi manzili"><Input value={e.employerAddress ?? ''} onChange={(ev) => setEmp({ employerAddress: ev.target.value })} /></Field>
          {/*
            One column, not two. Spanning the row pushed «Lavozim» onto a line of its own and left
            the field far wider than the answer needs — the trigger truncates a long sector anyway,
            and the menu wraps it.
          */}
          <Field label="Soha" hint="Ixtiyoriy — ro‘yxatda bo‘lmasa «Boshqa» ni tanlang">
            {/*
              Shown in the interface language, stored in Russian: `value` stays the workbook's
              string, which is what the risk code is looked up by and what the documents print.
              `keywords` keeps every option findable by typing Russian, Uzbek or English.
            */}
            <Select searchable menuWidth={380} value={(e.sector ?? '') as string} onChange={(v) => setEmp({ sector: v, sectorRiskCode: sectorRiskCode(v) })}
              options={[
                ...SECTOR_RISK.map((s) => ({ value: s.label, label: lang === 'ru' ? s.label : s.uz, keywords: `${s.label} ${s.uz} ${s.search}` })),
                { value: SECTOR_OTHER, label: lang === 'ru' ? SECTOR_OTHER_RU : SECTOR_OTHER, keywords: `${SECTOR_OTHER} ${SECTOR_OTHER_RU} other` },
              ]} />
          </Field>
          <Field label="Lavozim"><Select value={(e.position ?? '') as string} onChange={(v) => setEmp({ position: v })} options={opt(['Рахбарият', 'ўрта менежер', 'мутахассис', 'хизмат кўрсатувчи'])} /></Field>
          <Field label="Ish staji (sana)"><Input value={e.employedSince ?? ''} onChange={(ev) => setEmp({ employedSince: ev.target.value })} placeholder="2024 й." /></Field>
          <Field label="Umumiy staj"><Select value={(e.experienceBand ?? '') as string} onChange={(v) => setEmp({ experienceBand: v })} options={opt(['до 3 лет', '3-5 лет', '5-9 лет', '10 и более'])} /></Field>
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-white">Daromad va xarajat</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Asosiy daromad" required={bigLoan} error={bigLoan && f.attempted && !((a.mainActivityIncome ?? 0) > 0) ? 'Majburiy' : undefined}><MoneyInput value={a.mainActivityIncome ?? null} onChange={(v) => setAff({ mainActivityIncome: v })} /></Field>
          <Field label="Qo‘shimcha daromad"><MoneyInput value={a.secondaryIncome ?? null} onChange={(v) => setAff({ secondaryIncome: v })} /></Field>
          <Field label="Oila a'zolari daromadi"><MoneyInput value={a.familyIncome ?? null} onChange={(v) => setAff({ familyIncome: v })} /></Field>
          <Field label="Boshqa daromad"><MoneyInput value={a.otherIncome ?? null} onChange={(v) => setAff({ otherIncome: v })} /></Field>
          <Field label="Kommunal xarajat"><MoneyInput value={a.utilitiesExpense ?? null} onChange={(v) => setAff({ utilitiesExpense: v })} /></Field>
          <Field label="Oilaviy xarajat"><MoneyInput value={a.familyExpense ?? null} onChange={(v) => setAff({ familyExpense: v })} /></Field>
          <Field label="Boshqa xarajat"><MoneyInput value={a.otherExpense ?? null} onChange={(v) => setAff({ otherExpense: v })} /></Field>
          <Field label="Mavjud kredit to‘lovi" hint="KATM o‘rtacha oylik"><MoneyInput value={a.existingCreditBurden ?? null} onChange={(v) => setAff({ existingCreditBurden: v })} /></Field>
        </div>
      </Card>
    </div>
  );
}

/** Step 3 — Liniya (РКЛ). Sug'urta va garovlar endi alohida bosqichlarda (StepSugurta / StepGarov). */
export function Step3({ f }: { f: OriginationForm }) {
  const { data: cfg } = useQuery({ queryKey: ['app-config'], queryFn: () => api.getConfig() });
  const minRate = cfg?.minRate ?? 0.55;
  const l = f.form.creditLine ?? ({} as Line);
  const setLine = (p: Partial<Line>) => {
    const merged = { ...l, ...p } as Line;
    // Only recompute the total when a split field changed — never wipe a loaded amountTotal.
    const recompute = 'amountAuto' in p || 'amountPolis' in p;
    const amountTotal = recompute ? ((merged.amountAuto ?? 0) + (merged.amountPolis ?? 0) || null) : (merged.amountTotal ?? null);
    // The insurance-backed portion (amountPolis) IS the loan-under-policy; keep them in lockstep so
    // the insured sum (×1.3) and the flat-bracket premium always track the split.
    const insurance = 'amountPolis' in p
      ? ({ ...(merged.insurance ?? {}), loanUnderPolicy: merged.amountPolis ?? null } as Ins)
      : merged.insurance;
    f.patch({ creditLine: { ...merged, amountTotal, insurance, loanType: loanTypeFor(amountTotal), penaltyRate: merged.penaltyRate ?? 1.05 } });
  };
  const amountTotal = l.amountTotal ?? null;
  /*
    Liniya sanasi defaults to today (optional, editable); maturity is DERIVED = lineDate + termMonths.

    Recomputed every time either input changes, not just when it is empty. Guarding on
    `!l.lineMaturity` meant the first term the operator typed won the date forever: change 6 to 60
    afterwards and the bosh kelishuv still printed "60 oy muddatga, ya'ni <date> dan <date+6oy>
    gacha" — a contract stating a term and an end date that contradict each other.

    Safe to overwrite because there is no input for it: it is computed here and nowhere else.
  */
  useEffect(() => {
    const patch: Partial<Line> = {};
    if (!l.lineDate) patch.lineDate = new Date().toISOString().slice(0, 10);
    const from = l.lineDate ?? patch.lineDate;
    if (from && l.termMonths) {
      const base = new Date(from);
      const day = base.getDate();
      base.setDate(1); // shift month on the 1st to avoid day-of-month overflow (e.g. Jan 31 + 1 oy)
      base.setMonth(base.getMonth() + l.termMonths);
      const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(day, lastDay)); // clamp to the target month's length
      const next = base.toISOString().slice(0, 10);
      if (next !== l.lineMaturity) patch.lineMaturity = next;
    }
    if (Object.keys(patch).length) setLine(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.lineDate, l.termMonths]);
  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-white">Kredit liniyasi (РКЛ)</h2>
        {(() => {
          const product = (f.form.product ?? null) as LoanProduct | null;
          const isBig = loanTypeFor(amountTotal) === 'MICROCREDIT';
          const annual = Math.round((l.interestRate ?? minRate) * 100);
          const penalty = Math.round((l.penaltyRate ?? 1.05) * 100);
          // The product IS the credit type; the >100M warning colour is kept only for legacy
          // cases that carry no product.
          const useWarn = !product && isBig;
          return (
            <div className={cn('rounded-2xl border p-4', useWarn
              ? 'border-warning-200 bg-warning-50/60 dark:border-warning-500/20 dark:bg-warning-500/5'
              : 'border-brand-200 bg-brand-50/60 dark:border-brand-500/20 dark:bg-brand-500/5')}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Kredit turi</p>
                  <p className={cn('text-2xl font-bold', useWarn ? 'text-warning-700 dark:text-warning-400' : 'text-brand-700 dark:text-brand-400')}>{product ? loanProductProfile(product).label.uz : isBig ? 'Mikrokredit' : 'Mikroqarz'}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{product ? `${loanProductProfile(product).maxTermMonths} oygacha` : isBig ? '100 mln so‘mdan yuqori' : '100 mln so‘mgacha'}</p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-right">
                  <div><p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Yillik foiz</p><p className="nums text-xl font-bold text-gray-800 dark:text-white">{annual}%</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Jarima foizi</p><p className="nums text-xl font-bold text-gray-800 dark:text-white">{penalty}%</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Jami summa</p><p className="nums text-xl font-bold text-gray-800 dark:text-white">{amountTotal != null ? formatMoney(amountTotal) : '—'}</p></div>
                </div>
              </div>
            </div>
          );
        })()}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Liniya №, Jami summa, Yillik foiz, Jarima foizi, Shartnoma raqami — bu yerda ko'rsatilmaydi:
              jami summa va foizlar yuqoridagi kartada; liniya № va shartnoma raqami submit'da avtomatik beriladi. */}
          <Field label="Summa — avto/ko‘chmas"><MoneyInput value={l.amountAuto ?? null} onChange={(v) => setLine({ amountAuto: v })} /></Field>
          <Field label="Summa — polis"><MoneyInput value={l.amountPolis ?? null} onChange={(v) => setLine({ amountPolis: v })} /></Field>
          <Field label="Liniya muddati (oy)" required hint={`max ${LINE_TERM_CAP} oy (bosh kelishuv)`} error={(l.termMonths ?? 0) > LINE_TERM_CAP ? `Liniya muddati ${LINE_TERM_CAP} oydan oshmasligi kerak` : f.attempted ? f.errors.lineTerm : undefined}><Input type="number" min={1} max={LINE_TERM_CAP} value={l.termMonths ?? ''} onChange={(e) => setLine({ termMonths: numv(e.target.value) })} /></Field>
          <Field label="Liniya sanasi"><DatePicker value={l.lineDate ?? null} onChange={(iso) => setLine({ lineDate: iso })} /></Field>
        </div>
        {f.attempted && f.errors.amountTotal && <p className="text-xs font-medium text-error-600 dark:text-error-500">{f.errors.amountTotal}</p>}
      </Card>
      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800 dark:text-white">Kerakli qoplama</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Bu maydonlar ixtiyoriy — hisoblangan qiymat avtomatik ishlatiladi, keyinroq ham tahrirlashingiz mumkin.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Garov qoplami — mol-mulk ×140%" hint={l.amountAuto ? `hisoblangan: ${formatMoney(l.amountAuto * COLLATERAL_COVERAGE_TARGET)}` : 'summa kiriting'}>
            <MoneyInput value={l.requiredCollateralAmount ?? null} onChange={(v) => setLine({ requiredCollateralAmount: v })} placeholder={l.amountAuto ? formatMoney(l.amountAuto * COLLATERAL_COVERAGE_TARGET) : '—'} />
          </Field>
          <Field label="Sug‘urta summasi — polis ×130%" hint={l.amountPolis ? `hisoblangan: ${formatMoney(l.amountPolis * 1.3)}` : 'polis summasini kiriting'}>
            <MoneyInput value={l.requiredInsuredAmount ?? null} onChange={(v) => setLine({ requiredInsuredAmount: v })} placeholder={l.amountPolis ? formatMoney(l.amountPolis * 1.3) : '—'} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

/** Step — Sug'urta polisi: Liniyadan keyingi alohida bosqich. Ixtiyoriy (majburiy maydon yo'q). */
export function StepSugurta({ f }: { f: OriginationForm }) {
  const l = f.form.creditLine ?? ({} as Line);
  const ins = l.insurance ?? ({} as Ins);
  const setLine = (p: Partial<Line>) => f.patch({ creditLine: { ...l, ...p } as Line });
  const setIns = (p: Partial<Ins>) => setLine({ insurance: { ...ins, ...p } as Ins });

  // Asset products (AVTO/IPOTEKA) insure the ASSET (KASKO / property), not the loan-risk cover.
  // A distinct, manually-filled policy form — the bracket/×130% derivation below is loan-risk only.
  const insProduct = (f.form.product ?? null) as LoanProduct | null;
  if (insProduct && loanProductProfile(insProduct).kind === 'ASSET') {
    const label = ({ CAR: 'KASKO (mashina sug\'urtasi)', PROPERTY: 'Mulk sug\'urtasi', LOAN_RISK: '' } as const)[loanProductProfile(insProduct).insurance];
    return (
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-white">Sug‘urta — {label}</h2>
          <span className="rounded-md bg-warning-50 px-2 py-1 text-xs font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">Majburiy</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Asset kreditda aktivning o‘zi (garov) sug‘urtalanadi. Polis ma’lumotlarini kiriting.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Kompaniya"><Select value={(ins.company ?? '') as string} onChange={(v) => setIns({ company: v })} options={opt([...INSURANCE_COMPANIES])} /></Field>
          <Field label="Polis №"><Input value={ins.policyNo ?? ''} onChange={(e) => setIns({ policyNo: e.target.value })} /></Field>
          <Field label="Polis sanasi"><DatePicker value={ins.policyIssueDate ?? null} onChange={(iso) => setIns({ policyIssueDate: iso })} /></Field>
          <Field label="Polis muddati (oy)"><Input type="number" min={1} value={ins.policyTermMonths ?? ''} onChange={(e) => setIns({ policyTermMonths: numv(e.target.value) })} /></Field>
          <Field label="Sug‘urta summasi"><MoneyInput value={ins.insuredSum ?? null} onChange={(n) => setIns({ insuredSum: n, insured: true })} /></Field>
          <Field label="Sug‘urta mukofoti (premiya)"><MoneyInput value={ins.premium ?? null} onChange={(n) => setIns({ premium: n, insured: true })} /></Field>
        </div>
      </Card>
    );
  }

  // Premium is a FLAT rate by term bracket (≤2 yil → 2%, 2–4 yil → 4%) of the insured sum — derived,
  // not entered. Term capped at 48 months (4 years) for the effective bracket.
  const policyMonths = Math.min(ins.policyTermMonths ?? 0, INSURANCE_MAX_MONTHS) || null;
  const bracketRate = insurancePremiumRate(policyMonths);
  const calc = originationCalc({ loanUnderPolicy: ins.loanUnderPolicy, policyTermMonths: policyMonths, requiredInsuredAmount: l.requiredInsuredAmount });
  const termTooLong = (ins.policyTermMonths ?? 0) > INSURANCE_MAX_MONTHS;
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 dark:text-white">Sug‘urta polisi</h2>
        <Toggle checked={ins.insured ?? false} onChange={(v) => setIns(v ? { insured: v, loanUnderPolicy: l.amountPolis ?? ins.loanUnderPolicy ?? null } : { insured: v })} label="Sug‘urtalangan" />
      </div>
      {!ins.insured && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sug‘urta ixtiyoriy — polis qo‘shish uchun yuqoridagi tugmani yoqing. Polis summasi Liniya bosqichidagi «Summa — polis»dan olinadi.</p>
      )}
      {ins.insured && (
        <>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/50 p-2.5 text-xs dark:border-brand-500/20 dark:bg-brand-500/5">
          <span className="rounded-md bg-white px-2 py-1 font-medium text-brand-700 shadow-sm dark:bg-white/10 dark:text-brand-300">Polis qismi ×130%</span>
          <span className={cn('rounded-md px-2 py-1 font-medium', bracketRate === 0.02 ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 dark:bg-white/10 dark:text-gray-300')}>≤ 2 yil → 2%</span>
          <span className={cn('rounded-md px-2 py-1 font-medium', bracketRate === 0.04 ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 dark:bg-white/10 dark:text-gray-300')}>2–4 yil → 4%</span>
          <span className="rounded-md bg-white px-2 py-1 font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">max 4 yil</span>
          {calc.premium > 0 && <span className="ml-auto font-semibold text-gray-800 dark:text-white">Sug‘urta puli: <span className="nums">{formatMoney(calc.premium)}</span></span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Kompaniya"><Select value={(ins.company ?? '') as string} onChange={(v) => setIns({ company: v })} options={opt([...INSURANCE_COMPANIES])} /></Field>
          <Field label="Sug‘urta raqami (gen)" hint="polisdan oldin"><Input value={ins.genAgreementNo ?? ''} onChange={(e) => setIns({ genAgreementNo: e.target.value })} placeholder={INSURANCE_GEN_PREFIX} /></Field>
          <Field label="Polis №"><Input value={ins.policyNo ?? ''} onChange={(e) => setIns({ policyNo: e.target.value })} /></Field>
          <Field label="Polis sanasi"><DatePicker value={ins.policyIssueDate ?? null} onChange={(iso) => setIns({ policyIssueDate: iso })} /></Field>
          <Field label="Polis muddati (oy)" hint="max 48 oy (4 yil)" error={termTooLong ? 'Sug‘urta muddati 48 oydan oshmaydi' : undefined}><Input type="number" min={1} max={INSURANCE_MAX_MONTHS} value={ins.policyTermMonths ?? ''} onChange={(e) => setIns({ policyTermMonths: numv(e.target.value) })} /></Field>
          <Field label="Polis ostidagi kredit" hint="= polis summasi"><Input readOnly value={ins.loanUnderPolicy != null ? formatMoney(ins.loanUnderPolicy) : '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
          <Field label="Sug‘urta stavkasi" hint="muddatga qarab"><Input readOnly value={bracketRate ? `${(bracketRate * 100).toFixed(0)}%` : '—'} className="bg-gray-50 dark:bg-white/5" /></Field>
          <Field label="Sug‘urta summasi" hint="polis ×130%"><Input readOnly value={formatMoney(calc.insuredSum)} className="nums bg-gray-50 dark:bg-white/5" /></Field>
          <Field label="Sug‘urta puli" hint="summa × bracket"><Input readOnly value={formatMoney(calc.premium)} className="nums bg-gray-50 dark:bg-white/5" /></Field>
        </div>
        </>
      )}
    </Card>
  );
}

/** Step 3b — Garovlar: tab ko'rinishida, har garovda maydonlar + rasm/video + ishonchnoma + tex skaner. */
export function StepGarov({ f }: { f: OriginationForm }) {
  const qc = useQueryClient();
  const [activeCol, setActiveCol] = useState(0);
  const [delIdx, setDelIdx] = useState<number | null>(null); // collateral pending delete-confirmation
  const cols = f.form.collaterals;
  const active = cols.length ? Math.min(activeCol, cols.length - 1) : 0; // never -1 on empty
  const addCol = (t: ProductType) => { f.addCol(t); setActiveCol(cols.length); };
  const l = f.form.creditLine ?? ({} as Line);
  const ins = l.insurance ?? ({} as Ins);
  const collateralTotal = cols.reduce((s, c) => s + (c.agreedValue ?? 0), 0);
  const amountAuto = l.amountAuto ?? null;
  const amountTotal = l.amountTotal ?? null;
  const policyMonths = Math.min(ins.policyTermMonths ?? 0, INSURANCE_MAX_MONTHS) || null;
  const calc = originationCalc({ loanUnderPolicy: ins.loanUnderPolicy, policyTermMonths: policyMonths, requiredInsuredAmount: l.requiredInsuredAmount });

  // Asset products: the purchased item (car/house) IS the collateral. Start empty (default 0) and let
  // the operator add the one asset with a single button — its price then drives the down payment.
  const gProduct = (f.form.product ?? null) as LoanProduct | null;
  const gIsAsset = gProduct ? loanProductProfile(gProduct).kind === 'ASSET' : false;
  const gAssetType = gProduct === 'AVTO' ? ProductType.AUTO : gProduct === 'IPOTEKA' ? ProductType.REAL_ESTATE : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-white">{gIsAsset ? 'Sotib olinayotgan aktiv (garov)' : 'Garovlar'} <span className="text-gray-500 dark:text-gray-400">({cols.length})</span></h2>
          {/* Add-a-collateral buttons — hidden for asset products, whose single asset is auto-added. */}
          {!gIsAsset && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => addCol(ProductType.REAL_ESTATE)}><Plus className="h-4 w-4" /><House className="h-4 w-4" /> Uy-joy</Button>
              <Button variant="secondary" onClick={() => addCol(ProductType.AUTO)}><Plus className="h-4 w-4" /><Car className="h-4 w-4" /> Avto</Button>
            </div>
          )}
        </div>
        {gIsAsset && <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Sotib olinayotgan {gProduct === 'AVTO' ? 'mashina' : 'uy-joy'} — u avtomatik garov bo‘ladi. Narxini (kelishilgan qiymat) kiriting; boshlang‘ich to‘lov «Sotuvchi» bosqichida shundan hisoblanadi.</p>}
        {/* One tab per collateral — green ✓ when complete, red ! when a required field is missing.
            Only the selected collateral is shown below. */}
        <ol className="mb-3 flex flex-wrap gap-2">
          {cols.map((c, i) => {
            const done = collateralComplete(c);
            const cur = active === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setActiveCol(i)}
                  aria-current={cur ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                    cur && 'ring-2 ring-brand-500/40',
                    done
                      ? 'border-success-300 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-400'
                      : 'border-error-300 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400',
                  )}
                >
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-success-600 text-white' : 'bg-error-600 text-white')}>
                    {done ? <Check className="h-3 w-3" /> : '!'}
                  </span>
                  {gIsAsset ? 'Aktiv' : `Garov ${i + 1}`} · {c.type === ProductType.AUTO ? 'Avto' : 'Uy-joy'}
                </button>
              </li>
            );
          })}
        </ol>
        {cols.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-error-300 bg-error-50/50 p-8 text-center dark:border-error-500/40 dark:bg-error-500/5">
            <p className="font-medium text-error-700 dark:text-error-400">{gIsAsset ? 'Sotib olinayotgan aktiv qo‘shilmagan' : 'Hali garov qo‘shilmagan — majburiy'}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{gIsAsset ? 'Sotib olinayotgan aktivni qo‘shing — u avtomatik garov bo‘ladi.' : (<>Yuqoridagi tugmalar bilan <b>Uy-joy</b> yoki <b>Avto</b> garov qo‘shing — kamida bittasi to‘liq to‘ldirilishi shart.</>)}</p>
            <div className="mt-4 flex justify-center gap-2">
              {(!gIsAsset || gAssetType === ProductType.REAL_ESTATE) && <Button variant="secondary" onClick={() => addCol(ProductType.REAL_ESTATE)}><Plus className="h-4 w-4" /><House className="h-4 w-4" /> Uy-joy</Button>}
              {(!gIsAsset || gAssetType === ProductType.AUTO) && <Button variant="secondary" onClick={() => addCol(ProductType.AUTO)}><Plus className="h-4 w-4" /><Car className="h-4 w-4" /> Avto</Button>}
            </div>
          </div>
        ) : cols[active] && (
          <CollateralCard
            key={active}
            index={active}
            c={cols[active]}
            borrowerName={f.form.borrower.fullName}
            errors={f.attempted ? collateralErrors(cols[active]) : undefined}
            onChange={(p) => f.setCol(active, p)}
            onRemove={() => setDelIdx(active)}
            canRemove
            mediaSlot={<>
              <CollateralAttachments f={f} colIndex={active} type={DocumentType.COLLATERAL_PHOTO} accept="image/*,video/*" title="Rasm / video" max={10} />
              <CollateralAttachments f={f} colIndex={active} type={DocumentType.GEN_DOVERNOST} accept="image/*,application/pdf" title="Ishonchnoma" max={5} />
            </>}
            texSlot={<TexScan
              storeKey={`tex:${f.caseId ?? 'new'}:${active}`}
              onExtract={(p) => f.setCol(active, p)}
              onScanImages={async (files) => { const id = await saveCollateralMedia(f, active, files); if (id) qc.invalidateQueries({ queryKey: ['col-att', id, active, DocumentType.COLLATERAL_PHOTO] }); }}
            />}
            docs={[]} onAddDocs={() => undefined} onRemoveDoc={() => undefined} onSetDocField={() => undefined}
          />
        )}
        {f.attempted && f.errors.collateral && (
          <p className="mt-2 text-xs font-medium text-error-600 dark:text-error-500">{f.errors.collateral}</p>
        )}
      </div>
      {(amountAuto || amountTotal) != null && (
        <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
          {amountAuto != null && amountAuto > 0 && (() => {
            const requiredCollateral = l.requiredCollateralAmount ?? amountAuto * COLLATERAL_COVERAGE_TARGET;
            const ok = collateralTotal >= requiredCollateral;
            return <p>Garov qoplami (mol-mulk qismi): <b className={`nums ${ok ? 'text-gray-800 dark:text-white' : 'text-error-600 dark:text-error-500'}`}>{((collateralTotal / amountAuto) * 100).toFixed(0)}%</b> (kerak: {formatMoney(requiredCollateral)})</p>;
          })()}
          {(l.amountPolis ?? 0) > 0 && (
            <p>Sug‘urta qoplami (polis qismi): <b className="nums text-gray-800 dark:text-white">130%</b> → sug‘urta summasi {formatMoney(calc.insuredSum)}</p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={delIdx !== null}
        onClose={() => setDelIdx(null)}
        onConfirm={() => { if (delIdx !== null) { f.removeCol(delIdx); setActiveCol(Math.max(0, delIdx - 1)); } setDelIdx(null); }}
        title="Garovni o‘chirasizmi?"
        message={delIdx !== null ? `Garov ${delIdx + 1} butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.` : undefined}
        confirmLabel="Ha, o‘chiraman"
        cancelLabel="Bekor qilish"
        tone="danger"
      />
    </div>
  );
}

/** Step 4 — Transh. */
export function Step4({ f }: { f: OriginationForm }) {
  const { data: cfg } = useQuery({ queryKey: ['app-config'], queryFn: () => api.getConfig() });
  const l = f.form.creditLine ?? ({} as Line);
  const t = l.tranche ?? ({} as Tr);
  const setTr = (p: Partial<Tr>) => f.patch({ creditLine: { ...l, tranche: { ...t, ...p } as Tr } });
  const method = (t.scheduleType || undefined) as RepaymentMethod | undefined;
  const rate = l.interestRate ?? cfg?.minRate ?? 0.55;
  // Oylik to'lov is derived (annuitet PMT / differensial 1-oy) and locked — never typed by hand.
  const monthly = monthlyPaymentFor(method, t.principal, t.termMonths, rate);
  useEffect(() => {
    if ((t.monthlyPayment ?? null) !== (monthly ?? null)) setTr({ monthlyPayment: monthly });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly]);
  // Hidden fields default automatically: tranche № = 1, application date = today (drives the payment
  // day). Kept out of the UI — they are auto-derived, not entered by hand.
  const appDate = t.applicationDate || new Date().toISOString().slice(0, 10);
  useEffect(() => {
    const patch: Partial<Tr> = {};
    if (t.trancheNo == null) patch.trancheNo = 1;
    if (!t.applicationDate) patch.applicationDate = appDate;
    if (Object.keys(patch).length) setTr(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // To'lov kuni is derived from the application date: the day-of-month, capped at 15.
  const paymentDay = paymentDayFor(appDate);
  useEffect(() => {
    if ((t.paymentDay ?? null) !== (paymentDay ?? null)) setTr({ paymentDay });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentDay]);
  // A term over the method's cap is a hard rule — surface it live, not only after a submit attempt.
  const capExceeded = !!method && !!t.termMonths && !isTermValid(method, t.termMonths);
  const cap = method ? termCapFor(method) : null;
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-gray-800 dark:text-white">Transh (drawdown)</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Transh №, Ariza №, Ariza sanasi, To'lov kuni, Oylik to'lov, Sug'urta to'lovi — hidden: all
            auto-derived (Transh №=1, ariza № va sana avto, to'lov kuni sanadan, oylik to'lov jadvaldan,
            sug'urta tizimda hisoblanadi). Oylik to'lov chapdagi Xulosada ko'rinadi. Kerak bo'lsa qaytaramiz. */}
        <Field label="Asosiy summa" required error={f.attempted ? f.errors.principal : undefined}><MoneyInput value={t.principal ?? null} onChange={(v) => setTr({ principal: v })} /></Field>
        <Field label="Jadval turi" required error={f.attempted ? f.errors.scheduleType : undefined}><Select value={(t.scheduleType ?? '') as 'ANNUITY' | 'DIFFERENTIATED' | ''} onChange={(v) => setTr({ scheduleType: v })} options={[{ value: 'ANNUITY', label: 'Annuitet (max 30 oy)' }, { value: 'DIFFERENTIATED', label: 'Differensial (max 48 oy)' }]} /></Field>
        <Field label="Muddat (oy)" required hint={cap ? `max ${cap} oy` : 'avval jadval turini tanlang'} error={capExceeded ? `Muddat 1–${cap} oy oralig‘ida` : f.attempted ? f.errors.trancheTerm : undefined}>
          <Input type="number" min={1} max={cap ?? undefined} value={t.termMonths ?? ''} onChange={(e) => setTr({ termMonths: numv(e.target.value) })} />
        </Field>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">Oylik to‘lov, to‘lov kuni va sug‘urta to‘lovi tizimda avtomatik hisoblanadi (chapdagi Xulosada ko‘rinadi).</p>
    </Card>
  );
}

/** Step 5 — KATM (credit history). */
export function Step5({ f }: { f: OriginationForm }) {
  const h = f.form.creditHistory ?? ({} as Hist);
  const set = (p: Partial<Hist>) => f.patch({ creditHistory: { ...h, ...p } as Hist });
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-800 dark:text-white">KATM — kredit tarixi</h2>
        {f.attempted && f.errors.katm && <span className="text-xs font-medium text-error-600 dark:text-error-500">{f.errors.katm}</span>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="To‘langan kreditlar soni" required><Input type="number" value={h.repaidLoansCount ?? ''} onChange={(e) => set({ repaidLoansCount: numv(e.target.value) })} /></Field>
        <Field label="Aktiv kreditlar soni" required><Input type="number" value={h.activeLoansCount ?? ''} onChange={(e) => set({ activeLoansCount: numv(e.target.value) })} /></Field>
        <Field label="Muddati o‘tgan (0/1)" required><Input type="number" value={h.overdueSubstandardFlag ?? ''} onChange={(e) => set({ overdueSubstandardFlag: numv(e.target.value) })} /></Field>
        <Field label="Boshqa majburiyatlar" required><Input type="number" value={h.otherObligations ?? ''} onChange={(e) => set({ otherObligations: numv(e.target.value) })} /></Field>
        <Field label="5 mln+ kredit" required><Select value={(h.loansOver5MFlag ?? '') as string} onChange={(v) => set({ loansOver5MFlag: v })} options={opt(['Мавжуд', 'Мавжуд эмас'])} /></Field>
        <Field label="MKO/lombard tarixi" required><Select value={(h.priorMfiPawnshopFlag ?? '') as string} onChange={(v) => set({ priorMfiPawnshopFlag: v })} options={opt(['Мавжуд', 'Мавжуд эмас'])} /></Field>
        <Field label="Jami qarz" required><MoneyInput value={h.totalOutstandingDebt ?? null} onChange={(v) => set({ totalOutstandingDebt: v })} /></Field>
        <Field label="O‘rtacha oylik to‘lov" required><MoneyInput value={h.avgMonthlyPaymentExisting ?? null} onChange={(v) => set({ avgMonthlyPaymentExisting: v })} /></Field>
        {/* Komitet protokoli va Komitet qarori sanasi — olib tashlandi (komitet qarori keyingi bosqichda,
            operator origination'ida emas). Kerak bo'lsa qaytaramiz:
        <Field label="Komitet protokoli"><Input value={h.committeeProtocolRef ?? ''} onChange={(e) => set({ committeeProtocolRef: e.target.value })} /></Field>
        <Field label="Komitet qarori sanasi"><DatePicker value={h.committeeDecisionDate ?? null} onChange={(iso) => set({ committeeDecisionDate: iso })} /></Field> */}
      </div>
    </Card>
  );
}

/**
 * Sotuvchi bosqichi (faqat AVTO/IPOTEKA) — sotuvchi (firma yoki jismoniy shaxs egasi) +
 * boshlang'ich to'lov / LTV xulosasi. Aktivning o'zi garov, shuning uchun narx garov
 * qiymatidan olinadi; boshlang'ich = narx − qarz.
 */
export function StepSeller({ f }: { f: OriginationForm }) {
  const toast = useToast();
  const { data: firms = [] } = useQuery({ queryKey: ['sellersCatalog'], queryFn: () => api.sellersCatalog() });
  const [kind, setKind] = useState<'LEGAL' | 'INDIVIDUAL'>('LEGAL');
  const [indiv, setIndiv] = useState({ fullName: '', pinfl: '', passport: '', address: '', phone: '', bankAccount: '', ownershipDoc: '' });
  const [saving, setSaving] = useState(false);
  const [downInput, setDownInput] = useState('');

  const product = (f.form.product ?? null) as LoanProduct | null;
  const minDown = product ? loanProductProfile(product).minDownPayment * 100 : 0;
  // Firm catalog is product-specific: avtosalons for AVTO, builders for IPOTEKA.
  const firmCategory = product === 'AVTO' ? 'AUTO' : product === 'IPOTEKA' ? 'REALTY' : null;
  const firmList = firmCategory ? firms.filter((s) => s.category === firmCategory) : firms;
  const firmLabel = product === 'AVTO' ? 'Avtosalon' : product === 'IPOTEKA' ? 'Quruvchi firma' : 'Firma';
  const insLabel = product
    ? ({ CAR: "KASKO (mashina sug'urtasi)", PROPERTY: "Mulk sug'urtasi", LOAN_RISK: "Qarz xavfi sug'urtasi" } as const)[loanProductProfile(product).insurance]
    : '';
  const price = f.form.collaterals?.[0]?.agreedValue ?? null;
  const loan = f.form.creditLine?.amountTotal ?? f.form.amount ?? null;
  const down = price != null && loan != null ? price - loan : null;
  const ltv = price && loan != null ? (loan / price) * 100 : null;
  const downPct = price && down != null ? (down / price) * 100 : null;
  const belowMin = downPct != null && downPct < minDown;

  // Down payment DRIVES the loan: the operator types the percent, the financed amount is the rest
  // (loan = price × (1 − down%)). Seeded once from any existing loan/price so edits show up.
  useEffect(() => {
    if (downInput === '' && price && loan != null && price > 0) {
      const d = ((price - loan) / price) * 100;
      if (d >= 0 && d < 100) setDownInput(String(Math.round(d)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price, loan]);

  const applyDown = (v: string) => {
    setDownInput(v);
    const pct = Number(v);
    if (price && v !== '' && !isNaN(pct) && pct >= 0 && pct < 100) {
      const newLoan = Math.round(price * (1 - pct / 100));
      f.patch(
        f.form.creditLine
          ? { amount: newLoan, creditLine: { ...f.form.creditLine, amountAuto: newLoan, amountPolis: 0, amountTotal: newLoan } }
          : { amount: newLoan },
      );
    }
  };

  const saveIndiv = async () => {
    if (!indiv.fullName.trim()) { toast.error('Tekshiring', 'Sotuvchi F.I.Sh. sini kiriting'); return; }
    setSaving(true);
    try {
      const s = await api.createSeller({
        kind: SellerKind.INDIVIDUAL,
        fullName: indiv.fullName,
        pinfl: indiv.pinfl || null,
        passport: indiv.passport || null,
        address: indiv.address || null,
        phone: indiv.phone || null,
        bankAccount: indiv.bankAccount || null,
        ownershipDoc: indiv.ownershipDoc || null,
      });
      f.patch({ sellerId: s.id });
      toast.success('Saqlandi', 'Sotuvchi (jismoniy shaxs)');
    } catch {
      toast.error('Xatolik', 'Sotuvchi saqlanmadi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-white">Sotuvchi (distributor)</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant={kind === 'LEGAL' ? 'primary' : 'secondary'} onClick={() => setKind('LEGAL')}>Firma</Button>
          <Button variant={kind === 'INDIVIDUAL' ? 'primary' : 'secondary'} onClick={() => setKind('INDIVIDUAL')}>Jismoniy shaxs (egasi)</Button>
        </div>
        {kind === 'LEGAL' ? (
          <Field label={firmLabel}>
            <Select
              searchable
              value={f.form.sellerId ?? ''}
              onChange={(v) => f.patch({ sellerId: v || null })}
              options={[{ value: '', label: '— tanlang —' }, ...firmList.map((s) => ({ value: s.id, label: s.orgName ?? s.id }))]}
            />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="F.I.Sh."><Input value={indiv.fullName} onChange={(e) => setIndiv({ ...indiv, fullName: e.target.value })} /></Field>
            <Field label="JSHSHIR (PINFL)"><Input value={indiv.pinfl} onChange={(e) => setIndiv({ ...indiv, pinfl: e.target.value })} /></Field>
            <Field label="Passport (seriya va raqam)"><Input value={indiv.passport} onChange={(e) => setIndiv({ ...indiv, passport: e.target.value })} placeholder="AA 1234567" /></Field>
            <Field label="Manzil"><Input value={indiv.address} onChange={(e) => setIndiv({ ...indiv, address: e.target.value })} /></Field>
            <Field label="Telefon"><Input value={indiv.phone} onChange={(e) => setIndiv({ ...indiv, phone: e.target.value })} /></Field>
            <Field label="Karta / hisob raqami"><Input value={indiv.bankAccount} onChange={(e) => setIndiv({ ...indiv, bankAccount: e.target.value })} /></Field>
            <Field label="Egalik hujjati (kadastr / tex passport)"><Input value={indiv.ownershipDoc} onChange={(e) => setIndiv({ ...indiv, ownershipDoc: e.target.value })} /></Field>
            <div className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">Passport rasmlari va egalik hujjatlari (kadastr / tex passport) «Hujjatlar» bo‘limiga yuklanadi.</div>
            <div className="sm:col-span-2"><Button onClick={saveIndiv} disabled={saving}>{saving ? '…' : 'Sotuvchini saqlash'}</Button></div>
          </div>
        )}
        {f.form.sellerId && <p className="text-sm font-medium text-success-700 dark:text-success-400">✓ Sotuvchi bog'landi</p>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-800 dark:text-white">Boshlang'ich to'lov / LTV</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Aktivning o'zi garov. Boshlang'ich to'lovni kiriting — qarz avtomatik hisoblanadi (qarz = narx − boshlang'ich).</p>
        {price == null ? (
          <p className="text-sm font-medium text-warning-700 dark:text-warning-400">Avval «Garov» bosqichida aktiv (uy / mashina) narxini kiriting.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Boshlang'ich to'lov (%) — min ${minDown}%`}>
                <Input type="number" value={downInput} onChange={(e) => applyDown(e.target.value)} placeholder={String(minDown)} />
              </Field>
              <div className="self-end text-sm text-gray-600 dark:text-gray-300">Qarz (MMT): <b className="text-gray-900 dark:text-white">{loan != null ? formatMoney(loan) : '—'}</b></div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="text-gray-600 dark:text-gray-300">Aktiv narxi: <b className="text-gray-900 dark:text-white">{formatMoney(price)}</b></div>
              <div className="text-gray-600 dark:text-gray-300">Boshlang'ich (so'm): <b className="text-gray-900 dark:text-white">{down != null ? formatMoney(down) : '—'}</b></div>
              <div className="text-gray-600 dark:text-gray-300">LTV: <b className="text-gray-900 dark:text-white">{ltv != null ? `${ltv.toFixed(1)}%` : '—'}</b></div>
              <div className="text-gray-600 dark:text-gray-300">Sug'urta: <b className="text-gray-900 dark:text-white">{insLabel || '—'}</b></div>
            </div>
            {belowMin && <p className="text-sm font-medium text-warning-700 dark:text-warning-400">⚠ Boshlang'ich {minDown}% dan past — tekshiring (bloklamaydi).</p>}
          </>
        )}
      </Card>
    </div>
  );
}
