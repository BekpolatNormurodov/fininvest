import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import {
  ProductType, RepaymentMethod, loanTypeFor, isTermValid, termCapFor, LINE_TERM_CAP, MICRO_THRESHOLD,
  collateralComplete, collateralMissing,
  type UpsertCasePayload, type CaseSectionKey, type CollateralDto,
} from '@credit-core/shared';

const emptyContact = () => ({ relation: null, fullName: null, phone: null });
// Two close-contact rows are shown by default — both are required (min 2, max 5).
const emptyBorrower = { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, birthDate: null, address: null, phone: null, closeContacts: [emptyContact(), emptyContact()] };
const newCollateral = (type: ProductType): CollateralDto => ({
  type,
  agreedValue: null,
  agreedValueWords: null,
  owners: [],
  ...(type === ProductType.REAL_ESTATE ? { realtyKind: 'APARTMENT' as const } : {}),
});

const emptyForm: UpsertCasePayload = {
  amount: null, termMonths: null, borrower: { ...emptyBorrower }, guarantors: [],
  collaterals: [],
  employment: null, affordability: null, creditLine: null, creditHistory: null,
};

/** Prefill carried from "Hujjatlar tekshirish" → an ariza via router state (identifier only). */
type Prefill = { borrower?: Partial<UpsertCasePayload['borrower']>; collateral?: { type: ProductType; patch: Partial<CollateralDto> } };

/** Merge a prefill into a form — sets borrower identifier fields, fills the first empty matching
 *  collateral (or appends one) with the queried №. Pure, so it works for a new form or a loaded draft. */
function applyPrefill(form: UpsertCasePayload, pre: Prefill): UpsertCasePayload {
  let next = form;
  if (pre.borrower) next = { ...next, borrower: { ...next.borrower, ...pre.borrower } };
  if (pre.collateral) {
    const { type, patch } = pre.collateral;
    const keyField: keyof CollateralDto = type === ProductType.AUTO ? 'stateNumber' : 'cadastreNo';
    const cols = next.collaterals;
    const idx = cols.findIndex((c) => c.type === type && !c[keyField]);
    const collaterals = idx >= 0
      ? cols.map((c, i) => (i === idx ? { ...c, ...patch } : c))
      : [...cols, { ...newCollateral(type), ...patch }];
    next = { ...next, collaterals };
  }
  return next;
}

/** Shared state + autosave for the origination wizard. */
export function useOriginationForm(id?: string) {
  const qc = useQueryClient();
  const location = useLocation();
  const [caseId, setCaseId] = useState<string | undefined>(id);
  const [form, setForm] = useState<UpsertCasePayload>(emptyForm);
  const prefilledRef = useRef(false);

  // "Hujjatlar tekshirish" → Arizaga qo'shish carries the queried identifier in router state. Merge it
  // once: for a NEW ariza here, or for an EXISTING draft inside the loader below (on top of loaded
  // data). prefilledRef guards against re-applying on a react-query refetch.
  useEffect(() => {
    if (prefilledRef.current || id) return;
    const pre = (location.state as { prefill?: Prefill } | null)?.prefill;
    if (!pre) return;
    setForm((fm) => applyPrefill(fm, pre));
    prefilledRef.current = true;
  }, [location.state, id]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  // Auto contract number — assigned on submit, read-only in the wizard (null in DRAFT).
  const [contractNumber, setContractNumber] = useState<string | null>(null);
  const [contractYearlyNo, setContractYearlyNo] = useState<number | null>(null);

  useQuery({
    queryKey: ['case', id], enabled: !!id,
    queryFn: async () => {
      const c = await api.case(id!);
      setContractNumber(c.contractNumber);
      setContractYearlyNo(c.contractYearlyNo);
      // Backfill close-contact rows to the required minimum of 2 for the form.
      const loadedContacts = c.borrower?.closeContacts ?? [];
      const closeContacts = loadedContacts.length >= 2 ? loadedContacts : [...loadedContacts, emptyContact(), emptyContact()].slice(0, Math.max(2, loadedContacts.length));
      const loaded: UpsertCasePayload = {
        amount: c.amount, termMonths: c.termMonths,
        borrower: c.borrower ? { ...c.borrower, closeContacts } : { ...emptyBorrower }, guarantors: c.guarantors,
        collaterals: c.collaterals,
        employment: c.employment, affordability: c.affordability, creditLine: c.creditLine, creditHistory: c.creditHistory,
      };
      // Add-to-draft: apply the "Hujjatlar tekshirish" prefill on top of the loaded draft, once.
      const pre = !prefilledRef.current ? (location.state as { prefill?: Prefill } | null)?.prefill : undefined;
      setForm(pre ? applyPrefill(loaded, pre) : loaded);
      if (pre) prefilledRef.current = true;
      setCaseId(c.id);
      return c;
    },
  });

  const patch = (p: Partial<UpsertCasePayload>) => setForm((f) => ({ ...f, ...p }));
  const setBorrower = (b: Partial<UpsertCasePayload['borrower']>) => setForm((f) => ({ ...f, borrower: { ...f.borrower, ...b } }));
  const setCol = (i: number, p: Partial<CollateralDto>) => setForm((f) => ({ ...f, collaterals: f.collaterals.map((c, idx) => (idx === i ? { ...c, ...p } : c)) }));
  const addCol = (type: ProductType) => setForm((f) => ({ ...f, collaterals: [...f.collaterals, newCollateral(type)] }));
  const removeCol = (i: number) => setForm((f) => ({ ...f, collaterals: f.collaterals.filter((_, idx) => idx !== i) }));

  // Close contacts (yaqin kishilar) — min 2, max 5.
  const contacts = () => form.borrower.closeContacts ?? [];
  const setContact = (i: number, p: Partial<{ relation: string | null; fullName: string | null; phone: string | null }>) =>
    setBorrower({ closeContacts: contacts().map((c, idx) => (idx === i ? { ...c, ...p } : c)) });
  const addContact = () => { if (contacts().length < 5) setBorrower({ closeContacts: [...contacts(), emptyContact()] }); };
  const removeContact = (i: number) => { if (contacts().length > 2) setBorrower({ closeContacts: contacts().filter((_, idx) => idx !== i) }); };

  /** Ensure the case exists (create it if not), returning its id — used before uploading documents. */
  const ensureCase = async (): Promise<string | undefined> => {
    if (caseId) return caseId;
    const created = await api.createCase(form);
    setCaseId(created.id);
    qc.invalidateQueries({ queryKey: ['cases'] });
    return created.id;
  };

  // Core required set (confirmed with the operator): identity essentials + line amount/term +
  // tranche schedule/term/principal + at least one valued collateral. Everything else is optional.
  const b = form.borrower;
  const line = form.creditLine;
  const tr = line?.tranche;
  const method = tr?.scheduleType as RepaymentMethod | undefined;
  const amountTotal = line?.amountTotal ?? form.amount ?? null;
  const validContacts = (b.closeContacts ?? []).filter((c) => c.fullName?.trim() && c.phone?.trim());
  const h = form.creditHistory;
  const katmFilled = !!h
    && h.repaidLoansCount != null && h.activeLoansCount != null && h.overdueSubstandardFlag != null
    && h.otherObligations != null && !!h.loansOver5MFlag && !!h.priorMfiPawnshopFlag
    && h.totalOutstandingDebt != null && h.avgMonthlyPaymentExisting != null;
  const collateralError = (() => {
    const cs = form.collaterals;
    if (cs.length === 0) return 'Kamida 1 ta garov qo‘shing';
    // Newly purchased assets (AVTO/IPOTEKA) relax plate/tex-passport/cadastre requirements.
    const purchase = form.product === 'AVTO' || form.product === 'IPOTEKA';
    const i = cs.findIndex((c) => !collateralComplete(c, purchase));
    return i >= 0
      ? `Garov ${i + 1}: ${collateralMissing(cs[i], purchase).map((m) => m.label).join(', ')} majburiy`
      : undefined;
  })();
  const errors = {
    fullName: b.fullName.trim() ? undefined : 'F.I.O majburiy',
    contacts: validContacts.length >= 2 ? undefined : 'Kamida 2 ta yaqin kishi (ism + telefon) majburiy',
    pinfl: (b.pinfl ?? '').length === 14 ? undefined : 'PINFL 14 raqam bo‘lishi kerak',
    passportSeries: (b.passportSeries ?? '').length === 2 ? undefined : 'Seriya majburiy (AA)',
    passportNumber: (b.passportNumber ?? '').length === 7 ? undefined : 'Raqam majburiy (7 raqam)',
    phone: b.phone ? undefined : 'Telefon majburiy',
    // Mikrokredit (100 mln+) — ish joyi va asosiy daromad majburiy (mikroqarzda ixtiyoriy).
    employment: (amountTotal ?? 0) > MICRO_THRESHOLD
      && (!form.employment?.employer?.trim() || !((form.affordability?.mainActivityIncome ?? 0) > 0))
      ? '100 mln+ — ish joyi va asosiy daromad majburiy'
      : undefined,
    amountTotal: amountTotal && amountTotal > 0 ? undefined : 'Jami summa majburiy',
    lineTerm: !line?.termMonths || line.termMonths <= 0
      ? 'Liniya muddati majburiy'
      : line.termMonths > LINE_TERM_CAP
        ? `Liniya muddati ${LINE_TERM_CAP} oydan oshmasligi kerak`
        : undefined,
    collateral: collateralError,
    scheduleType: method ? undefined : 'Jadval turini tanlang',
    trancheTerm: !method
      ? 'Avval jadval turini tanlang'
      : isTermValid(method, tr?.termMonths)
        ? undefined
        : `Muddat 1–${termCapFor(method)} oy oralig‘ida`,
    principal: tr?.principal && tr.principal > 0 ? undefined : 'Asosiy summa majburiy',
    katm: katmFilled ? undefined : 'KATM bo‘limi to‘liq to‘ldirilishi shart',
  } as const;
  type ErrKey = keyof typeof errors;
  // Errors per wizard step, keyed by a STABLE step key (not the display index) so the wizard can
  // reorder steps per product (e.g. put the asset first for AVTO/IPOTEKA) without misaligning them.
  const STEP_ERRORS: Record<string, ErrKey[]> = {
    borrower: ['fullName', 'pinfl', 'passportSeries', 'passportNumber', 'phone', 'contacts'],
    employment: ['employment'],
    creditLine: ['amountTotal', 'lineTerm'],
    sugurta: [],
    garov: ['collateral'],
    transh: ['scheduleType', 'trancheTerm', 'principal'],
    katm: ['katm'],
    seller: [],
  };
  const stepHasErrors = (key: string) => (STEP_ERRORS[key] ?? []).some((k) => errors[k]);
  // A step is "complete" (green ✓) only when it actually HAS required fields and all are satisfied.
  // Ish & daromad is conditional (majburiy only for 100 mln+), so it goes green ONLY when the key
  // fields are actually filled — never green by default on a blank form.
  const employmentFilled = !!form.employment?.employer?.trim() && (form.affordability?.mainActivityIncome ?? 0) > 0;
  const stepComplete = (key: string) =>
    key === 'employment' ? employmentFilled : (STEP_ERRORS[key] ?? []).length > 0 && !stepHasErrors(key);
  const valid = (Object.keys(errors) as ErrKey[]).every((k) => !errors[k]);

  /** Persist one section (autosave). Creates the case first if it doesn't exist yet. */
  const saveSection = async (section: CaseSectionKey) => {
    setSaving(true);
    try {
      // A brand-new case is fully persisted by createCase — no immediate section PATCH needed.
      if (!caseId) {
        const created = await api.createCase(form);
        setCaseId(created.id);
        qc.invalidateQueries({ queryKey: ['cases'] });
        return created;
      }
      const saved = await api.saveCaseSection(caseId, { section, data: form });
      qc.invalidateQueries({ queryKey: ['case', caseId] });
      return saved;
    } finally { setSaving(false); }
  };

  const save = async () => {
    if (!valid) { setAttempted(true); return undefined; }
    setSaving(true);
    try {
      const saved = caseId ? await api.updateCase(caseId, form) : await api.createCase(form);
      setCaseId(saved.id);
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['case', saved.id] });
      return saved;
    } finally { setSaving(false); }
  };

  return {
    form, setForm, patch, setBorrower, setCol, addCol, removeCol,
    setContact, addContact, removeContact,
    step, setStep, saving, attempted, setAttempted, errors, valid, stepHasErrors, stepComplete, saveSection, save,
    caseId, ensureCase, contractNumber, contractYearlyNo,
    loanType: loanTypeFor(amountTotal),
  };
}

export type OriginationForm = ReturnType<typeof useOriginationForm>;
