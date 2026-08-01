import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Banknote, CheckCircle2, Clock, Download, FileDown, FileText, Pencil, Pause, Play, RotateCcw, Send, Flag, Upload, Eye, House, Car, Paperclip, Trash2, X, Plus, Minus, Messages, Key, ChevronDown,
} from '../lib/icons';
import { api, downloadBlob, viewDocument, documentInlineUrl, getErrorMessage } from '@credit-core/api-client';
import {
  CaseStatus, computeLoan, DocumentType, DOCUMENT_LABEL, originationCalc, PRODUCT_LABEL, Role, ROLE_LABEL,
  TRANSITIONS, WorkflowDecision, resolveOwners, ownerIsImplied, loanProductProfile,
  type RepaymentMethod, type ScorableCase, type CreditCaseDto, type DocumentDto,
} from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input, Skeleton, StatusBadge } from '../components/primitives';
import { Modal } from '../components/Modal';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { Select, MoneyInput } from '../components/forms';
import { CaseTimeline } from '../components/CaseTimeline';
import { SignDialog } from '../components/SignDialog';
import { ScorePanel } from '../components/ScorePanel';
import { CollectionCaseCard } from '../components/CollectionCaseCard';
import { useToast } from '../components/Toast';
import { cn, formatMoney } from '../lib/cn';

// Externally-produced scans attached only after the director has approved the case — each is a
// single named slot matched by DocumentDto.title, not a new DocumentType or a document category.
const SCAN_SLOTS = [
  { title: 'Гаров шартномаси' },
  { title: 'Тақиқ карточкаси' },
  { title: 'Умумий иш (Опшая дела)' },
] as const;

const decisionLabel: Record<WorkflowDecision, string> = {
  [WorkflowDecision.SUBMIT]: 'Yuborish', [WorkflowDecision.APPROVE]: 'Tasdiqlash',
  [WorkflowDecision.RETURN]: 'Qaytarish', [WorkflowDecision.FINALIZE]: 'Yakunlash',
  [WorkflowDecision.CANCEL]: 'Bekor qilish', [WorkflowDecision.REOPEN]: 'Qayta to‘ldirishga qaytarish',
};
const decisionIcon: Record<WorkflowDecision, React.ComponentType<{ className?: string }>> = {
  [WorkflowDecision.SUBMIT]: Send, [WorkflowDecision.APPROVE]: CheckCircle2,
  [WorkflowDecision.RETURN]: RotateCcw, [WorkflowDecision.FINALIZE]: Flag,
  [WorkflowDecision.CANCEL]: X, [WorkflowDecision.REOPEN]: RotateCcw,
};
// "Yuborish" reads as its destination — the operator sees "Moderatorga yuborish", so it's clear
// where the case goes next (operator → moderator → director → admin).
const sendTarget: Partial<Record<CaseStatus, Role>> = {
  [CaseStatus.MODERATION]: Role.MODERATOR,
  [CaseStatus.DIRECTOR_REVIEW]: Role.DIRECTOR,
  [CaseStatus.ADMIN_FINALIZE]: Role.ADMIN,
};
function transitionLabel(t: { to: CaseStatus; decision: WorkflowDecision }) {
  const target = sendTarget[t.to];
  const relabel = t.decision === WorkflowDecision.SUBMIT || t.decision === WorkflowDecision.APPROVE;
  return target && relabel ? `${ROLE_LABEL[target]}ga yuborish` : decisionLabel[t.decision];
}

/** A compact launcher tile — icon + label + count/hint — opening a section modal or navigating. */
function LauncherTile({
  icon: Icon, label, hint, onClick, ariaLabel, trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  onClick: () => void;
  ariaLabel: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="group flex min-h-[44px] flex-1 basis-40 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left outline-none transition hover:border-brand-300 hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-800 dark:text-white">{label}</span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
      {trailing}
    </button>
  );
}

export function CaseView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [katm, setKatm] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseDays, setPauseDays] = useState(2);
  const [signOpen, setSignOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<null | 'history'>(null);

  const { data: c, isLoading } = useQuery({ queryKey: ['case', id], queryFn: () => api.case(id!) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['case', id] });
    qc.invalidateQueries({ queryKey: ['cases'] });
  };

  const toast = useToast();
  const transition = useMutation({
    mutationFn: (decision: WorkflowDecision) => api.transition(id!, { decision, comment: comment || undefined }),
    // Director approval no longer comes through here — it is a real signature and goes via
    // SignDialog (sign/prepare → sign/commit), which reports its own outcome.
    onSuccess: () => {
      setComment(''); refresh();
    },
    // Surface the backend's reason — for submit-to-moderation this is the full list of incomplete
    // required fields (e.g. "PINFL 14 raqam; Garov 1: Kadastr № majburiy; KATM …").
    onError: (err) => toast.error('Yuborib bo‘lmadi', getErrorMessage(err)),
  });

  const { data: appCfg } = useQuery({ queryKey: ['app-config'], queryFn: () => api.getConfig() });
  const maxPauseDays = Math.max(1, appCfg?.maxPauseDays ?? 5);
  const pauseMut = useMutation({
    mutationFn: (days: number) => api.pauseCase(id!, days),
    onSuccess: () => { setPauseOpen(false); refresh(); },
  });
  const resumeMut = useMutation({ mutationFn: () => api.resumeCase(id!), onSuccess: refresh });
  const openPause = () => { setPauseDays(Math.min(2, maxPauseDays)); setPauseOpen(true); };
  const deleteMut = useMutation({
    mutationFn: () => api.deleteCase(id!, deleteReason.trim()),
    onSuccess: () => {
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ['cases'] });
      toast.success('O‘chirildi', 'Qoralama o‘chirildi');
      navigate('/');
    },
    onError: () => toast.error('Xatolik', 'O‘chirib bo‘lmadi'),
  });
  const restoreMut = useMutation({
    mutationFn: () => api.restoreCase(id!),
    onSuccess: () => { refresh(); toast.success('Aktivlashtirildi', 'Ariza faol ro‘yxatga qaytdi'); },
    onError: () => toast.error('Xatolik', 'Qaytarib bo‘lmadi'),
  });

  if (isLoading || !c) return <CaseViewSkeleton />;

  const role = user!.role;
  const isArchived = !!c.deletedAt; // soft-deleted draft — no workflow / edit actions, only restore
  const myTransitions = isArchived ? [] : TRANSITIONS.filter((t) => t.from === c.status && t.role === role);
  const isOperatorDraft = role === Role.OPERATOR && c.status === CaseStatus.DRAFT && !isArchived;
  // Operator deletes their own draft (list is already scoped to own cases); admin deletes any draft.
  const canDeleteDraft = c.status === CaseStatus.DRAFT && !isArchived && (role === Role.OPERATOR || role === Role.ADMIN);
  const canRestore = isArchived && (role === Role.OPERATOR || role === Role.ADMIN);
  const isDirectorReview = role === Role.DIRECTOR && c.status === CaseStatus.DIRECTOR_REVIEW;
  // Any authenticated role (operator/moderator/director/admin) may attach a document in any
  // non-archived state — the document list is already visible to all.
  const canUpload = !isArchived;
  const canManageDocs = canUpload || role === Role.ADMIN;
  // Post-director-approval scan slots (collateral contract / encumbrance card / general file) —
  // uploaded by operator/moderator/director once the case reaches ADMIN_FINALIZE or FINALIZED.
  const showScanSlots = c.status === CaseStatus.ADMIN_FINALIZE || c.status === CaseStatus.FINALIZED;
  const canUploadScans = role === Role.OPERATOR || role === Role.MODERATOR || role === Role.DIRECTOR;
  const activeStep = c.status === CaseStatus.MODERATION || c.status === CaseStatus.DIRECTOR_REVIEW || c.status === CaseStatus.ADMIN_FINALIZE;
  const canPauseResume = (role === Role.MODERATOR || role === Role.DIRECTOR || role === Role.ADMIN) && (activeStep || !!c.pausedAt);
  const loan = appCfg ? computeLoan(c.amount, c.termMonths, appCfg) : null;
  const showFinance = role !== Role.OPERATOR;

  // Cancel + reopen are routed through one "Bekor qilish" choice dialog, not direct buttons.
  const inlineTransitions = myTransitions.filter(
    (t) => t.decision !== WorkflowDecision.CANCEL && t.decision !== WorkflowDecision.REOPEN,
  );
  const canCancel = myTransitions.some((t) => t.decision === WorkflowDecision.CANCEL);
  const canReopen = myTransitions.some((t) => t.decision === WorkflowDecision.REOPEN);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-gray-500 outline-none transition hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
      >
        <ArrowRight className="h-4 w-4 rotate-180" /> Orqaga
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="nums text-2xl font-bold text-gray-800 dark:text-white">{c.contractNumber ?? c.number}</h1>
            <StatusBadge status={c.status} />
            <DeadlineBadge deadlineAt={c.stepDeadlineAt} paused={!!c.pausedAt} pauseUntil={c.pauseUntil} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {PRODUCT_LABEL[c.productType]} • {c.branch?.name ?? '—'}
            {c.contractNumber && <span className="text-gray-400 dark:text-gray-500"> • Ariza: {c.number}</span>}
          </p>
        </div>
        {(isOperatorDraft || canDeleteDraft || canRestore) && (
          <div className="flex flex-wrap items-center gap-2">
            {isOperatorDraft && (
              <Link to={`/cases/${c.id}/origination`}><Button variant="secondary"><Pencil className="h-5 w-5" /> Tahrirlash</Button></Link>
            )}
            {canDeleteDraft && (
              <Button variant="danger" onClick={() => { setDeleteReason(''); setDeleteOpen(true); }}><Trash2 className="h-5 w-5" /> O‘chirish</Button>
            )}
            {canRestore && (
              <Button loading={restoreMut.isPending} onClick={() => restoreMut.mutate()}><RotateCcw className="h-5 w-5" /> Aktivlashtirish</Button>
            )}
          </div>
        )}
      </div>

      {isArchived && (
        <div className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 p-3.5 text-sm dark:border-error-500/20 dark:bg-error-500/10">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-error-600 dark:text-error-400" />
          <div>
            <p className="font-semibold text-error-700 dark:text-error-300">Bu qoralama o‘chirilgan (arxivda)</p>
            {c.deletedReason && <p className="mt-0.5 text-error-600/90 dark:text-error-400/90">Sabab: {c.deletedReason}</p>}
            {c.deletedAt && <p className="mt-0.5 text-xs text-error-600/70 dark:text-error-400/70">{new Date(c.deletedAt).toLocaleString('ru-RU')}</p>}
          </div>
        </div>
      )}

      {/*
        3:2 split, not 2:1. At a third of the width the right-hand cards — Amaliyot, Yakunlash,
        Ariza ma'lumotlari — wrapped their labels onto extra lines and ran tall and narrow. Two
        fifths gives them room to read on one line each. `lg:self-start` stops the column being
        stretched to the (usually taller) left one, and `lg:sticky` keeps the actions in view while
        the long left column scrolls.
      */}
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Detail c={c} canUpload={canUpload} canManage={canManageDocs} />

          {showFinance && loan && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"><Banknote className="h-5 w-5" /></span>
                <h2 className="font-semibold text-gray-800 dark:text-white">Moliyaviy hisob-kitob</h2>
                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-300">ustama {Math.round(loan.markupPercent * 100)}% · {loan.termMonths} oy</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FinTile label="Kredit summasi" value={formatMoney(loan.principal)} />
                <FinTile label="Klient jami to‘lovi" value={formatMoney(loan.clientTotal)} accent />
                <FinTile label="Oylik to‘lov" value={formatMoney(loan.monthlyPayment)} />
                <FinTile label="Ustama (foyda)" value={formatMoney(loan.markupAmount)} />
              </div>
              {(role === Role.DIRECTOR || role === Role.ADMIN) && (
                <div className="grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-800">
                  <FinTile label={`Bank oylik (${Math.round(loan.bankRate * 100)}%)`} value={formatMoney(loan.bankMonthly)} />
                  <FinTile label="Bank foiz xarajati" value={formatMoney(loan.bankInterest)} />
                  <FinTile label="Yalpi foyda" value={formatMoney(loan.grossProfit)} />
                  <FinTile label="NPL yo‘qotish" value={formatMoney(loan.nplLoss)} />
                  <FinTile label="Daromad solig‘i" value={formatMoney(loan.tax)} />
                  <FinTile label="Sof foyda" value={formatMoney(loan.netProfit)} accent />
                </div>
              )}
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-700 outline-none dark:text-brand-400">
                  <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" /> To‘lov jadvali ({loan.termMonths} oy)
                </summary>
                <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-white/5 dark:text-gray-400">
                      <tr><th className="px-3 py-2 text-left font-medium">Oy</th><th className="px-3 py-2 text-right font-medium">To‘lov</th><th className="px-3 py-2 text-right font-medium">Qoldiq</th></tr>
                    </thead>
                    <tbody>
                      {loan.schedule.map((r) => (
                        <tr key={r.month} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-1.5 text-gray-700 dark:text-gray-200">{r.month}</td>
                          <td className="nums px-3 py-1.5 text-right text-gray-700 dark:text-gray-200">{formatMoney(Math.round(r.payment))}</td>
                          <td className="nums px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{formatMoney(Math.round(r.balance))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap gap-3">
              <LauncherTile
                icon={FileDown}
                label="Hujjatlar"
                hint={c.status === CaseStatus.DRAFT ? 'Ariza yuborilgach shakllanadi' : 'Ko‘rish va yuklash'}
                ariaLabel="Hujjatlar sahifasiga o‘tish"
                onClick={() => navigate(`/cases/${c.id}/hujjatlar`)}
                trailing={<ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400" />}
              />
              <LauncherTile
                icon={Clock}
                label="Harakatlar tarixi"
                hint={`${c.events.length} ta harakat`}
                ariaLabel={`Harakatlar tarixi (${c.events.length})`}
                onClick={() => setActiveSection('history')}
              />
              <LauncherTile
                icon={Messages}
                label="Chat"
                hint="Muloqotga o‘tish"
                ariaLabel="Chatga o‘tish"
                onClick={() => navigate(`/chats?case=${c.id}`)}
                trailing={<ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400" />}
              />
              {/* «Pul o'tkazish» is cash-only (ADM TEAM / OSON, and legacy). Asset products pay the
                  seller and carry the down-payment receipt instead. */}
              {c.product !== 'AVTO' && c.product !== 'IPOTEKA' && (
                <LauncherTile
                  icon={Banknote}
                  label="Pul o‘tkazish"
                  hint="Rekvizitlar (buxgalteriya)"
                  ariaLabel="Pul o‘tkazish rekvizitlari sahifasiga o‘tish"
                  onClick={() => navigate(`/cases/${c.id}/pul-otkazish`)}
                  trailing={<ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400" />}
                />
              )}
            </div>
          </Card>

          {showScanSlots && (
            <Card className="space-y-3">
              <h2 className="font-semibold text-gray-800 dark:text-white">Сканер ҳужжатлар (директор тасдиғидан кейин)</h2>
              <div className="space-y-2">
                {SCAN_SLOTS.map((slot) => (
                  <ScanSlotRow
                    key={slot.title}
                    caseId={c.id}
                    title={slot.title}
                    doc={c.documents.find((d) => d.title === slot.title)}
                    canUpload={canUploadScans}
                    canManage={canUploadScans}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
          <CollectionCaseCard caseId={c.id} caseLabel={c.contractNumber ?? c.number} />
          {(myTransitions.length > 0 || canPauseResume) && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-800 dark:text-white">Amaliyot</h2>
                {(c.stepDeadlineAt || c.pausedAt) && <DeadlineBadge deadlineAt={c.stepDeadlineAt} paused={!!c.pausedAt} pauseUntil={c.pauseUntil} />}
              </div>

              {c.pausedAt && (
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                  <p className="flex items-center gap-2">
                    <Pause className="h-4 w-4 shrink-0 text-gray-400" /> Ariza pauzada — muddat to‘xtatilgan.
                  </p>
                  {c.pauseUntil && (
                    <p className="mt-1 pl-6 text-xs text-gray-500 dark:text-gray-400">
                      Avtomatik davom etadi: <span className="font-medium text-gray-700 dark:text-gray-200">{new Date(c.pauseUntil).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </p>
                  )}
                </div>
              )}

              {myTransitions.length > 0 && (
                <>
                  <div>
                    <label htmlFor="case-comment" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Izoh (ixtiyoriy)</label>
                    <textarea
                      id="case-comment"
                      value={comment}
                      rows={2}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Qarorga izoh qoldiring…"
                      className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    {isDirectorReview && (
                      <p className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                        <Key className="h-4 w-4 shrink-0" /> Imzolashda hujjatlar generatsiya qilinib E-IMZO kalitingiz bilan imzolanadi — fayl biriktirish shart emas. Kalit ulangan va E-IMZO ochiq bo‘lsin.
                      </p>
                    )}
                    {inlineTransitions.map((t) => {
                      const Icon = decisionIcon[t.decision];
                      const busy = transition.isPending && transition.variables === t.decision;
                      // The director's approval is a real E-IMZO signature, not a status change:
                      // it opens the key dialog, which drives sign/prepare → sign/commit itself.
                      const isSign = isDirectorReview && t.decision === WorkflowDecision.APPROVE;
                      return (
                        <Button
                          key={t.decision}
                          variant={t.decision === WorkflowDecision.RETURN ? 'secondary' : 'primary'}
                          className="w-full"
                          loading={busy}
                          onClick={() => (isSign ? setSignOpen(true) : transition.mutate(t.decision))}
                        >
                          {!busy && (isSign ? <Key className="h-5 w-5" /> : <Icon className="h-5 w-5" />)}{' '}
                          {isSign ? 'Kalit bilan imzolash' : transitionLabel(t)}
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}

              {(canCancel || canPauseResume) && (
                <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                  {canPauseResume && (c.pausedAt ? (
                    <Button variant="secondary" className="flex-1" loading={resumeMut.isPending} onClick={() => resumeMut.mutate()}>
                      <Play className="h-5 w-5" /> Davom ettirish
                    </Button>
                  ) : (
                    <Button variant="secondary" className="flex-1" loading={pauseMut.isPending} disabled={!activeStep} onClick={openPause}>
                      <Pause className="h-5 w-5" /> Pauza
                    </Button>
                  ))}
                  {canCancel && (
                    <Button variant="danger" className="flex-1" loading={transition.isPending} onClick={() => setCancelOpen(true)}>
                      <X className="h-5 w-5" /> Bekor qilish
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* KATM price (+ finalize doc exports) moves to the director's review step — director
              approval is now the terminal action, mirroring canSetSplit's DIRECTOR_REVIEW gate. */}
          {isDirectorReview && <AdminPanel c={c} onChange={refresh} katm={katm} setKatm={setKatm} />}
          <CapturePanel c={c} role={role} onChange={refresh} />
          {(c.product === 'AVTO' || c.product === 'IPOTEKA') && (
            <DownPaymentReceiptPanel c={c} canUpload={role === Role.OPERATOR || role === Role.ADMIN || role === Role.DIRECTOR} onChange={refresh} />
          )}
        </div>
      </div>

      <SignDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        caseId={c.id}
        contractNumber={c.contractNumber ?? c.number}
        borrowerName={c.borrower?.fullName ?? '—'}
        onSigned={() => {
          setSignOpen(false);
          refresh();
          toast.success('Imzolandi', 'Hujjatlar kalitingiz bilan imzolandi va muzlatildi');
        }}
      />

      <Modal
        open={activeSection === 'history'}
        onClose={() => setActiveSection(null)}
        size="lg"
        title={`Harakatlar tarixi${c.events.length ? ` (${c.events.length})` : ''}`}
      >
        {activeSection === 'history' && <CaseTimeline events={c.events} />}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Qoralamani o‘chirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Bekor qilish</Button>
            <Button variant="danger" loading={deleteMut.isPending} disabled={!deleteReason.trim()} onClick={() => deleteMut.mutate()}>O‘chirish</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 dark:bg-error-500/10">
              <Trash2 className="h-6 w-6" />
            </span>
            <p className="pt-0.5 text-sm text-gray-600 dark:text-gray-300">
              <b className="text-gray-800 dark:text-white">«{c.number}»</b> butunlay o‘chiriladi — bu amalni orqaga qaytarib bo‘lmaydi.
            </p>
          </div>
          <Field label="O‘chirish sababi (majburiy)">
            <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Masalan: mijoz voz kechdi / xato kiritilgan" autoFocus />
          </Field>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} size="sm" title="Arizani bekor qilish" description="Qanday davom etamiz?">
        <div className="space-y-2.5">
          {canReopen && (
            <button
              type="button"
              disabled={transition.isPending}
              onClick={() => transition.mutate(WorkflowDecision.REOPEN, { onSettled: () => setCancelOpen(false) })}
              className="flex w-full items-start gap-3 rounded-xl border border-gray-200 p-3 text-left outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-50 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500"><RotateCcw className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-800 dark:text-white">Qayta to‘ldirishga qaytarish</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">Ariza operatorga qaytariladi — hujjatlarni qayta kiritib, qayta yuboradi.</span>
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={transition.isPending}
            onClick={() => transition.mutate(WorkflowDecision.CANCEL, { onSettled: () => setCancelOpen(false) })}
            className="flex w-full items-start gap-3 rounded-xl border border-gray-200 p-3 text-left outline-none transition hover:bg-error-50/60 focus-visible:ring-2 focus-visible:ring-error-600/30 disabled:opacity-50 dark:border-gray-800 dark:hover:bg-error-500/10"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500"><X className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-800 dark:text-white">To‘liq bekor qilish</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">Ariza butunlay bekor qilinadi. Buni qaytarib bo‘lmaydi.</span>
            </span>
          </button>
        </div>
      </Modal>

      <Modal
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        size="sm"
        title="Arizani pauzaga qo‘yish"
        description="SLA muddati to‘xtaydi va belgilangan kunlardan so‘ng avtomatik davom etadi."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPauseOpen(false)}>Bekor qilish</Button>
            <Button onClick={() => pauseMut.mutate(pauseDays)} loading={pauseMut.isPending}>
              <Pause className="h-5 w-5" /> Pauzaga qo‘yish
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Pauza muddati</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Eng ko‘pi {maxPauseDays} ish kuni</p>
            </div>
            <div className="inline-flex h-11 items-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-white/5">
              <button
                type="button"
                aria-label="Kamaytirish"
                disabled={pauseDays <= 1}
                onClick={() => setPauseDays((d) => Math.max(1, d - 1))}
                className="grid h-full w-10 place-items-center text-gray-500 outline-none transition hover:bg-gray-50 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="nums grid h-full w-12 place-items-center border-x border-gray-200 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">{pauseDays}</span>
              <button
                type="button"
                aria-label="Oshirish"
                disabled={pauseDays >= maxPauseDays}
                onClick={() => setPauseDays((d) => Math.min(maxPauseDays, d + 1))}
                className="grid h-full w-10 place-items-center text-gray-500 outline-none transition hover:bg-gray-50 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span><span className="font-medium text-gray-700 dark:text-gray-200">{pauseDays} ish kun</span>idan so‘ng ariza avtomatik davom etadi. Dam olish kunlari hisobga olinmaydi.</span>
          </p>
        </div>
      </Modal>
    </div>
  );
}

/** Structural placeholder while the case loads — mirrors the real two-column layout. */
function CaseViewSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Yuklanmoqda">
      <Skeleton className="h-7 w-24" />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="space-y-4">
            <Skeleton className="h-5 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </Card>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </Card>
        </div>
      </div>
    </div>
  );
}

function FinTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', accent ? 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10' : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/5')}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('nums mt-0.5 text-sm font-bold', accent ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-white')}>{value}</p>
    </div>
  );
}

/** View / download + (when allowed) replace / delete a document file row. */
function DocActions({ doc, canManage }: { doc: DocumentDto; canManage: boolean }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const replaceRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['case', id] });
  const del = useMutation({ mutationFn: () => api.deleteDocument(doc.id), onSuccess: () => { toast.success('Hujjat o‘chirildi'); refresh(); }, onError: () => toast.error('Xatolik', 'O‘chirib bo‘lmadi') });
  const rep = useMutation({ mutationFn: (f: File) => api.replaceDocument(doc.id, f), onSuccess: () => { toast.success('Hujjat almashtirildi'); refresh(); }, onError: () => toast.error('Xatolik', 'Almashtirib bo‘lmadi') });
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button onClick={() => viewDocument(doc.id, doc.fileName)} aria-label="Ko‘rish" title="Ko‘rish" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 outline-none transition hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-gray-400 dark:hover:bg-white/10"><Eye className="h-5 w-5" /></button>
      <button onClick={async () => downloadBlob(await api.downloadDocument(doc.id), doc.fileName)} aria-label="Yuklab olish" title="Yuklab olish" className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 outline-none transition hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-brand-400 dark:hover:bg-brand-500/10"><Download className="h-5 w-5" /></button>
      {canManage && (
        <>
          <input ref={replaceRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) rep.mutate(f); e.target.value = ''; }} />
          <button onClick={() => replaceRef.current?.click()} disabled={rep.isPending} aria-label="Almashtirish" title="Almashtirish" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 outline-none transition hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10"><Upload className="h-[18px] w-[18px]" /></button>
          <button onClick={() => del.mutate()} disabled={del.isPending} aria-label="O‘chirish" title="O‘chirish" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 outline-none transition hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-error-600/30 disabled:opacity-50 dark:hover:bg-error-500/10"><Trash2 className="h-[18px] w-[18px]" /></button>
        </>
      )}
    </div>
  );
}

/**
 * One named post-approval scan slot: shows the view/download/replace controls (via DocActions)
 * once a document with a matching title exists, otherwise an upload button that files it under
 * DocumentType.SCAN with that title so the slot flips to "uploaded" on the next refetch.
 */
function ScanSlotRow({
  caseId, title, doc, canUpload, canManage,
}: { caseId: string; title: string; doc: DocumentDto | undefined; canUpload: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDocument(caseId, DocumentType.SCAN, file, { title }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case', caseId] }); toast.success('Yuklandi', title); },
    onError: () => toast.error('Xatolik', 'Yuklanmadi'),
  });
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
      <div className="flex min-w-0 items-center gap-2.5 text-sm">
        <FileText className="h-5 w-5 shrink-0 text-gray-400" />
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-700 dark:text-gray-200">{title}</p>
          {doc ? (
            <p className="truncate text-xs text-gray-400 dark:text-gray-500">
              {doc.fileName} · {new Date(doc.uploadedAt).toLocaleString('ru-RU')}
              {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ''}
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">Hali yuklanmagan</p>
          )}
        </div>
      </div>
      {doc ? (
        <DocActions doc={doc} canManage={canManage} />
      ) : canUpload ? (
        <>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
          <Button variant="secondary" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
            <Upload className="h-5 w-5" /> Yuklash
          </Button>
        </>
      ) : (
        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">—</span>
      )}
    </div>
  );
}

/** Image thumbnail with view + (when allowed) a delete overlay. */
function ImgThumb({ doc, canManage, label, rounded = 'rounded-xl' }: { doc: DocumentDto; canManage: boolean; label?: string; rounded?: string }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({ mutationFn: () => api.deleteDocument(doc.id), onSuccess: () => { toast.success('O‘chirildi'); qc.invalidateQueries({ queryKey: ['case', id] }); }, onError: () => toast.error('Xatolik', 'O‘chirib bo‘lmadi') });
  const caption = label ?? doc.title ?? undefined;
  return (
    <div className={cn('group relative aspect-square overflow-hidden border border-gray-200 dark:border-gray-800', rounded)}>
      <button onClick={() => viewDocument(doc.id, doc.fileName)} aria-label={caption ? `${caption} · ${doc.fileName}` : doc.fileName} title={caption ? `${caption} · ${doc.fileName}` : doc.fileName} className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30">
        <img src={documentInlineUrl(doc.id)} alt={doc.fileName} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
      </button>
      {caption && <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{caption}</span>}
      {canManage && (
        <button onClick={() => del.mutate()} disabled={del.isPending} aria-label="O‘chirish" title="O‘chirish" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition hover:bg-error-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

function Detail({ c, canUpload, canManage }: { c: CreditCaseDto; canUpload: boolean; canManage: boolean }) {
  const totalCollateral = c.collaterals.reduce((s, x) => s + (x.agreedValue ?? 0), 0);
  const base: [string, string][] = [
    ['Qarz oluvchi', c.borrower?.fullName ?? '—'],
    ['Pasport', [c.borrower?.passportSeries, c.borrower?.passportNumber].filter(Boolean).join(' ') || '—'],
    ['PINFL', c.borrower?.pinfl ?? '—'],
    ['Telefon', c.borrower?.phone ?? '—'],
    ['Summa', formatMoney(c.amount)],
    ['Muddat', c.termMonths ? `${c.termMonths} oy` : '—'],
    ['Jami garov', formatMoney(totalCollateral)],
    ['KATM narxi', formatMoney(c.katmPrice)],
  ];
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="mb-3 font-semibold text-gray-800 dark:text-white">Qarz oluvchi va kredit</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {base.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{k}</dt>
              <dd className="nums text-sm font-medium text-gray-800 dark:text-gray-200">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {c.guarantors.length > 0 && (
        <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
          <h2 className="mb-2 font-semibold text-gray-800 dark:text-white">Kafillar ({c.guarantors.length})</h2>
          <div className="space-y-1.5">
            {c.guarantors.map((g, i) => (
              <div key={g.id ?? i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                <span className="font-medium text-gray-700 dark:text-gray-200">{g.fullName}</span>
                {g.relation && <span className="text-gray-500 dark:text-gray-400">· {g.relation}</span>}
                {g.passportNumber && <span className="nums text-gray-500 dark:text-gray-400">· {g.passportNumber}</span>}
                {g.phone && <span className="nums text-gray-500 dark:text-gray-400">· {g.phone}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        {/* Asset products (AVTO/IPOTEKA): the item is the purchased asset, not a pledge — the buyer
            becomes the owner, so no «Garov»/owner-warning framing. */}
        {(() => { const isAssetCase = c.product === 'AVTO' || c.product === 'IPOTEKA'; return (
        <h2 className="font-semibold text-gray-800 dark:text-white">{isAssetCase ? 'Sotib olinayotgan aktiv' : `Garovlar (${c.collaterals.length})`}</h2>
        ); })()}
        {c.collaterals.map((col, i) => {
          const isAuto = col.type === 'AUTO';
          const isPurchase = c.product === 'AVTO' || c.product === 'IPOTEKA';
          const rows: [string, string][] = isAuto
            ? [
                ['Model', col.model ?? '—'],
                ['Davlat raqami', col.stateNumber ?? '—'],
                ['Tex passport', col.techPassportNo ?? '—'],
                ['Rang / yil', `${col.color ?? '—'} / ${col.year ?? '—'}`],
                ['Probeg', col.mileage != null ? `${col.mileage} km` : '—'],
                ['Garov qiymati', formatMoney(col.agreedValue)],
              ]
            : [
                ['Manzil', col.address ?? '—'],
                ['Kadastr №', col.cadastreNo ?? '—'],
                ['Reestr №', col.registryNo ?? '—'],
                ['Maydon', `${col.totalAreaM2 ?? '—'} / ${col.livingAreaM2 ?? '—'} m²`],
                ['Xonalar', [col.roomNames, col.roomCount != null ? `(${col.roomCount})` : ''].filter(Boolean).join(' ') || '—'],
                ['Garov qiymati', formatMoney(col.agreedValue)],
              ];
          return (
            <div key={col.id ?? i} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${isAuto ? 'bg-warning-600' : 'bg-brand-700'}`}>
                  {isAuto ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
                </span>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{isPurchase ? `Sotib olinayotgan ${isAuto ? 'mashina' : 'uy-joy'}` : `Garov ${i + 1} — ${isAuto ? 'Avtotransport' : 'Uy-joy'}`}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{k}</dt>
                    <dd className="nums text-sm font-medium text-gray-800 dark:text-gray-200">{v}</dd>
                  </div>
                ))}
              </dl>
              {/*
                Shown for pledges only: every pledge document names an owner. For asset purchases the
                buyer becomes the owner, so there is no separate owner line/warning.
                With no owner entered the borrower stands in at 100% — say so explicitly rather than
                leaving the line out, which read as "nobody owns this".
              */}
              {!isPurchase && (() => {
                const owners = resolveOwners(col.owners, c.borrower);
                if (!owners.length) {
                  return (
                    <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                      Mulk egasi aniqlanmadi — egasini kiriting yoki qarz oluvchining F.I.Sh. sini to‘ldiring
                    </p>
                  );
                }
                const implied = ownerIsImplied(col.owners, c.borrower);
                return (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Egalar: {owners.map((o) => `${o.fullName}${o.sharePercent != null ? ` (${o.sharePercent}%)` : ''}`).join(', ')}
                    {implied && <span className="ml-1 italic">— qarz oluvchining o‘zi</span>}
                  </p>
                );
              })()}
              {col.id && (
                <>
                  <CollateralMedia
                    caseId={c.id}
                    collateralId={col.id}
                    docs={c.documents.filter((d) => d.collateralId === col.id)}
                    canUpload={canUpload}
                    canManage={canManage}
                  />
                  <CollateralDocs
                    caseId={c.id}
                    collateralId={col.id}
                    docs={c.documents.filter((d) => d.collateralId === col.id)}
                    canUpload={canUpload}
                    canManage={canManage}
                    isPurchase={isPurchase}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const COLLATERAL_MEDIA_MAX = 10;

/** Per-collateral photos & videos (min 1, max 10). Multi-select, uploads each as COLLATERAL_PHOTO. */
function CollateralMedia({
  caseId, collateralId, docs, canUpload, canManage,
}: { caseId: string; collateralId: string; docs: CreditCaseDto['documents']; canUpload: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const media = docs.filter((d) => { const m = d.mimeType ?? ''; return m.startsWith('image/') || m.startsWith('video/') || d.type === DocumentType.COLLATERAL_PHOTO; });
  const remaining = COLLATERAL_MEDIA_MAX - media.length;

  const onPick = async (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    if (!picked.length) return;
    if (picked.length > remaining) { toast.error('Ko‘p', `Ko‘pi ${COLLATERAL_MEDIA_MAX} ta — yana ${Math.max(0, remaining)} ta mumkin`); return; }
    setBusy(true);
    try {
      for (const file of picked) await api.uploadDocument(caseId, DocumentType.COLLATERAL_PHOTO, file, { collateralId });
      qc.invalidateQueries({ queryKey: ['case', caseId] });
      toast.success('Yuklandi', 'Garov rasm/videolari');
    } catch { toast.error('Yuklanmadi', 'Qayta urinib ko‘ring'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const remove = async (docId: string) => { await api.deleteDocument(docId); qc.invalidateQueries({ queryKey: ['case', caseId] }); };

  return (
    <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Rasm / video ({media.length}/{COLLATERAL_MEDIA_MAX})</p>
        {canUpload && remaining > 0 && (
          <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 outline-none transition hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-brand-400 dark:hover:bg-brand-500/10">
            <Upload className="h-3.5 w-3.5" /> Rasm / video
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
      {media.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Rasm yoki video biriktirish ixtiyoriy — ko‘pi 10 ta</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {media.map((d) => {
            const isVideo = (d.mimeType ?? '').startsWith('video/');
            return (
              <div key={d.id} className="group relative">
                <button type="button" onClick={() => viewDocument(d.id, d.fileName)} title={d.fileName} className="block aspect-square w-full overflow-hidden rounded-lg border border-gray-200 outline-none transition hover:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700">
                  {isVideo ? (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gray-900 text-white"><Play className="h-5 w-5" /><span className="text-[9px] font-medium">Video</span></span>
                  ) : (
                    <img src={documentInlineUrl(d.id)} alt={d.fileName} className="h-full w-full object-cover" />
                  )}
                </button>
                {canManage && (
                  <button type="button" onClick={() => remove(d.id)} aria-label="O‘chirish" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error-600 text-white opacity-0 shadow transition group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {busy && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Yuklanmoqda…</p>}
    </div>
  );
}

// Photos/videos are managed by CollateralMedia; this selector is for other documents only.
const COLLATERAL_DOC_TYPES: DocumentType[] = [
  DocumentType.TECH_PASSPORT, DocumentType.NOTARY, DocumentType.SCAN, DocumentType.OTHER,
];

function CollateralDocs({
  caseId, collateralId, docs, canUpload, canManage, isPurchase = false,
}: { caseId: string; collateralId: string; docs: CreditCaseDto['documents']; canUpload: boolean; canManage: boolean; isPurchase?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [docType, setDocType] = useState<DocumentType>(DocumentType.TECH_PASSPORT);

  const reset = () => { setFile(null); setTitle(''); setDescription(''); setDocType(DocumentType.TECH_PASSPORT); setOpen(false); };
  const upload = useMutation({
    mutationFn: () => api.uploadDocument(caseId, docType, file!, { collateralId, title: title || undefined, description: description || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case', caseId] }); toast.success('Hujjat biriktirildi', title || file?.name); reset(); },
    onError: () => toast.error('Xatolik', 'Hujjat yuklanmadi'),
  });

  // Photos/videos live in CollateralMedia above — this block manages the other documents only.
  const otherDocs = docs.filter((d) => { const m = d.mimeType ?? ''; return !(m.startsWith('image/') || m.startsWith('video/') || d.type === DocumentType.COLLATERAL_PHOTO); });
  const images = otherDocs.filter((d) => (d.mimeType ?? '').startsWith('image/'));
  const files = otherDocs.filter((d) => !(d.mimeType ?? '').startsWith('image/'));

  return (
    <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{isPurchase ? 'Aktiv hujjatlari' : 'Garov hujjatlari'} ({otherDocs.length})</p>
        {canUpload && !open && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 outline-none transition hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-brand-400 dark:hover:bg-brand-500/10">
            <Upload className="h-3.5 w-3.5" /> Hujjat biriktirish
          </button>
        )}
      </div>

      {otherDocs.length === 0 && !open && <p className="text-xs text-gray-400 dark:text-gray-500">Hali hujjat biriktirilmagan</p>}

      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((d) => <ImgThumb key={d.id} doc={d} canManage={canManage} rounded="rounded-lg" />)}
        </div>
      )}
      {files.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {files.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 dark:border-gray-800">
              <div className="flex min-w-0 items-start gap-2 text-sm">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-700 dark:text-gray-200">{d.title || DOCUMENT_LABEL[d.type]} <span className="font-normal text-gray-400 dark:text-gray-500">· {d.fileName}</span></p>
                  {d.description && <p className="text-xs text-gray-500 dark:text-gray-400">{d.description}</p>}
                </div>
              </div>
              <DocActions doc={d} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="space-y-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-white/5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Hujjat nomi"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="masalan: Kadastr ko‘chirmasi" /></Field>
            <Field label="Turi">
              <Select<DocumentType> value={docType} onChange={setDocType} options={COLLATERAL_DOC_TYPES.map((t) => ({ value: t, label: DOCUMENT_LABEL[t] }))} />
            </Field>
          </div>
          <Field label="Izoh (ixtiyoriy)"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qo‘shimcha tavsif…" /></Field>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}><Paperclip className="h-5 w-5" /> {file ? 'Faylni almashtirish' : 'Fayl tanlash'}</Button>
            {file && <span className="truncate text-xs text-gray-500 dark:text-gray-400">{file.name}</span>}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={reset}>Bekor qilish</Button>
              <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}><Upload className="h-5 w-5" /> Biriktirish</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPanel({
  c, onChange, katm, setKatm,
}: { c: CreditCaseDto; onChange: () => void; katm: string; setKatm: (v: string) => void }) {
  const saveKatm = useMutation({ mutationFn: () => api.setKatmPrice(c.id, Number(katm)), onSuccess: onChange });
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold text-gray-800 dark:text-white">Yakunlash</h2>
      <Field label="KATM narxi">
        <div className="flex gap-2">
          <MoneyInput value={katm ? Number(katm) : null} onChange={(v) => setKatm(v == null ? '' : String(v))} />
          <Button variant="secondary" onClick={() => saveKatm.mutate()} disabled={!katm}>Saqlash</Button>
        </div>
      </Field>
      <Button variant="secondary" className="w-full" onClick={async () => downloadBlob(await api.generatePdf(c.id), `Akt_${c.number}.pdf`)}>
        <FileDown className="h-5 w-5" /> PDF generatsiya (Akt)
      </Button>
      <Button variant="secondary" className="w-full" onClick={async () => downloadBlob(await api.exportExcel(c.id), `Garov_${c.number}.xlsx`)}>
        <Download className="h-5 w-5" /> Excel eksport
      </Button>
      <Button variant="secondary" className="w-full" onClick={async () => downloadBlob(await api.exportScheduleExcel(c.id), `Grafik_${c.number}.xlsx`)}>
        <Download className="h-5 w-5" /> Grafik (Excel)
      </Button>
    </Card>
  );
}

/** Captured 4-tab data (read-only) + operator edit link + moderator rate control. */
function CapturePanel({ c, role, onChange }: { c: CreditCaseDto; role: Role; onChange: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const cfg = useQuery({ queryKey: ['app-config'], queryFn: () => api.getConfig() });
  const line = c.creditLine;
  const af = c.affordability;
  const calc = originationCalc({
    mainActivityIncome: af?.mainActivityIncome, secondaryIncome: af?.secondaryIncome, familyIncome: af?.familyIncome, otherIncome: af?.otherIncome,
    utilitiesExpense: af?.utilitiesExpense, familyExpense: af?.familyExpense, otherExpense: af?.otherExpense, existingCreditBurden: af?.existingCreditBurden,
    newLoanPayment: line?.tranche?.monthlyPayment,
    requiredInsuredAmount: line?.requiredInsuredAmount,
    amountTotal: line?.amountTotal ?? c.amount, collateralTotal: c.collaterals.reduce((s, col) => s + (col.agreedValue ?? 0), 0),
    // Lets the requirement be sized over 36 months when the tranche runs longer (Д1!D43).
    repaymentMethod: line?.tranche?.scheduleType as RepaymentMethod | null | undefined,
    tranchePrincipal: line?.tranche?.principal,
    trancheTermMonths: line?.tranche?.termMonths,
    annualRate: line?.interestRate,
  });
  const canEdit = (role === Role.OPERATOR || role === Role.ADMIN) && c.status === CaseStatus.DRAFT;
  const canSetRate = role === Role.MODERATOR && c.status === CaseStatus.MODERATION;
  const canSetSplit = role === Role.DIRECTOR && c.status === CaseStatus.DIRECTOR_REVIEW;
  const [autoAmt, setAutoAmt] = useState<number | null>(line?.amountAuto ?? null);
  const [polisAmt, setPolisAmt] = useState<number | null>(line?.amountPolis ?? null);
  const splitTotal = (autoAmt ?? 0) + (polisAmt ?? 0);
  const split = useMutation({
    mutationFn: () => api.setCaseSplit(c.id, autoAmt ?? 0, polisAmt ?? 0),
    onSuccess: () => { onChange(); toast.success('Saqlandi', 'Summa taqsimoti'); },
    onError: () => toast.error('Xatolik', 'Taqsimotni saqlab bo‘lmadi'),
  });

  const minPct = Math.round((cfg.data?.minRate ?? 0.55) * 100);
  const maxPct = Math.round((cfg.data?.maxRate ?? 0.6) * 100);
  const [pct, setPct] = useState<number>(Math.round((line?.interestRate ?? cfg.data?.minRate ?? 0.55) * 100));
  const [rateReason, setRateReason] = useState('');
  const rate = useMutation({
    mutationFn: () => api.setCaseRate(c.id, pct / 100, rateReason.trim()),
    onSuccess: () => { onChange(); setRateReason(''); toast.success('Saqlandi', `Foiz ${pct}%`); },
    onError: () => toast.error('Xatolik', `Foiz ${minPct}–${maxPct}% oralig‘ida bo‘lishi kerak`),
  });

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="nums font-medium text-gray-800 dark:text-white">{value}</span>
    </div>
  );

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 dark:text-white">Ariza ma'lumotlari</h2>
        {canEdit && (
          <Button variant="secondary" onClick={() => navigate(`/cases/${c.id}/origination`)}>
            <Pencil className="h-4 w-4" /> To‘ldirish
          </Button>
        )}
      </div>
      {row('Kredit turi', c.product ? loanProductProfile(c.product).label.uz : line?.loanType ? (line.loanType === 'MICROCREDIT' ? 'Mikrokredit' : 'Mikroqarz') : '—')}
      {c.downPaymentPct != null && row('Boshlang‘ich to‘lov', `${c.downPaymentPct}%`)}
      {c.ltvPct != null && row('LTV (qarz / aktiv)', `${c.ltvPct}%`)}
      {c.seller && row('Sotuvchi', c.seller.orgName || c.seller.fullName || '—')}
      {row('Summa — mol-mulk', line?.amountAuto != null ? formatMoney(line.amountAuto) : '—')}
      {row('Summa — sug‘urta', line?.amountPolis != null ? formatMoney(line.amountPolis) : '—')}
      {row('Jami summa', (line?.amountTotal ?? c.amount) != null ? formatMoney((line?.amountTotal ?? c.amount)!) : '—')}
      {row('Yillik foiz', line?.interestRate != null ? `${Math.round(line.interestRate * 100)}%` : '—')}
      {row('Jami daromad', calc.totalIncome ? formatMoney(calc.totalIncome) : '—')}
      {row('Aktiv kreditlar', c.creditHistory?.activeLoansCount != null ? String(c.creditHistory.activeLoansCount) : '—')}
      {row('Jadval turi', line?.tranche?.scheduleType ? (line.tranche.scheduleType === 'ANNUITY' ? 'Annuitet' : 'Differensial') : '—')}

      {/*
        The score, on every case and for every role, whatever the status. It used to live only in
        the operator's wizard, so a moderator or director deciding on the case could not see the
        number they were deciding against — nor which of its twenty factors produced it.
      */}
      <ScorePanel
        subject={c as unknown as ScorableCase}
        coverageRatio={calc.coverageRatio}
        collateralTotal={c.collaterals.reduce((sum, col) => sum + (col.agreedValue ?? 0), 0)}
        collateralCount={c.collaterals.length}
        product={c.product ?? null}
      />

      {canSetRate && (
        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">Foizni sozlash ({minPct}–{maxPct}%) — risk uchun ko‘tarish mumkin</p>
          <div className="flex items-center gap-2">
            <Input type="number" min={minPct} max={maxPct} value={pct} onChange={(e) => setPct(Number(e.target.value) || minPct)} className="nums w-24" />
            <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
          </div>
          <Input value={rateReason} onChange={(e) => setRateReason(e.target.value)} placeholder="Sabab (majburiy)" />
          <Button className="w-full" loading={rate.isPending} disabled={!rateReason.trim()} onClick={() => rate.mutate()}>Saqlash</Button>
        </div>
      )}

      {canSetSplit && (
        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">Summa taqsimoti — rahbar baholaydi (mol-mulk ×140% garov, polis ×130% sug‘urta 2%/yil)</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mol-mulk (avto)"><MoneyInput value={autoAmt} onChange={setAutoAmt} /></Field>
            <Field label="Sug‘urta (polis)"><MoneyInput value={polisAmt} onChange={setPolisAmt} /></Field>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Jami: <b className="nums text-gray-800 dark:text-white">{formatMoney(splitTotal)}</b></p>
          <Button className="w-full" loading={split.isPending} disabled={splitTotal <= 0} onClick={() => split.mutate()}>Taqsimotni saqlash</Button>
        </div>
      )}
    </Card>
  );
}

/** 16-digit card grouped 4-4-4-4 ("5614 6818 1023 5717"); numeric fields keep digits only. */
const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).match(/.{1,4}/g)?.join(' ') ?? '';
const onlyDigits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

/**
 * Down-payment bank receipt (AVTO / IPOTEKA). The client pays the down payment at the bank and
 * brings a receipt; the operator uploads a photo of it here. Mandatory for accounting — the panel
 * flags «Majburiy» until at least one receipt is attached (uploaded after director approval).
 */
function DownPaymentReceiptPanel({ c, canUpload, onChange }: { c: CreditCaseDto; canUpload: boolean; onChange: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const receipts = c.documents.filter((d) => d.type === DocumentType.DOWN_PAYMENT_RECEIPT);

  const onPick = async (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    if (!picked.length) return;
    setBusy(true);
    try {
      for (const file of picked) await api.uploadDocument(c.id, DocumentType.DOWN_PAYMENT_RECEIPT, file, { title: 'Boshlang‘ich to‘lov kvitansiyasi' });
      onChange();
      toast.success('Yuklandi', 'To‘lov kvitansiyasi');
    } catch { toast.error('Yuklanmadi', 'Qayta urinib ko‘ring'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const remove = async (docId: string) => { await api.deleteDocument(docId); onChange(); };

  const has = receipts.length > 0;
  // The correct order: director approves first, THEN the client pays and brings the receipt. So it is
  // only "pending/mandatory" once the case is approved — before that it is simply a later step.
  const approved = c.status === CaseStatus.FINALIZED || (c.status as string) === 'ADMIN_FINALIZE';
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-gray-800 dark:text-white">Boshlang‘ich to‘lov kvitansiyasi</h2>
            {has
              ? <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">✓ {receipts.length} ta yuklangan</span>
              : approved
                ? <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">Kutilmoqda</span>
                : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">Tasdiqdan keyin</span>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Direktor tasdiqlaganidan so‘ng mijoz boshlang‘ich to‘lovni bankda to‘laydi — kvitansiyani rasmga olib yuklang (buxgalteriya uchun).
          </p>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => onPick(e.target.files)} />

      {has ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {receipts.map((d) => {
            const isPdf = (d.mimeType ?? '').includes('pdf');
            return (
              <div key={d.id} className="group relative">
                <button type="button" onClick={() => viewDocument(d.id, d.fileName)} title={d.fileName} className="block aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 outline-none transition hover:border-amber-400 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:border-gray-700 dark:bg-white/5">
                  {isPdf
                    ? <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500"><FileText className="h-6 w-6" /><span className="text-[10px] font-medium">PDF</span></span>
                    : <img src={documentInlineUrl(d.id)} alt={d.fileName} className="h-full w-full object-cover" />}
                </button>
                {canUpload && (
                  <button type="button" onClick={() => remove(d.id)} aria-label="O‘chirish" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error-600 text-white opacity-0 shadow transition group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          {canUpload && (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} aria-label="Yana kvitansiya qo‘shish"
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 outline-none transition hover:border-amber-400 hover:text-amber-600 focus-visible:ring-2 focus-visible:ring-amber-500/30 disabled:opacity-50 dark:border-gray-700 dark:hover:border-amber-500">
              <Plus className="h-5 w-5" />
              <span className="text-[10px] font-medium">{busy ? '…' : 'Yana'}</span>
            </button>
          )}
        </div>
      ) : canUpload ? (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-200 px-4 py-7 text-center outline-none transition hover:border-amber-400 hover:bg-amber-50/40 focus-visible:ring-2 focus-visible:ring-amber-500/30 disabled:opacity-50 dark:border-gray-700 dark:hover:border-amber-500">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"><Upload className="h-5 w-5" /></span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{busy ? 'Yuklanmoqda…' : 'Kvitansiyani yuklash'}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">Rasm yoki PDF — bir nechta bo‘lishi mumkin</span>
        </button>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400">
          Kvitansiya hali yuklanmagan — mijoz to‘lovni bankda qilgach yuklanadi.
        </p>
      )}
    </Card>
  );
}

/** Beneficiary bank requisites for the disbursement application ("Пул ўтказиш аризаси"). */
export function DisbursementPanel({ c, onChange, standalone = false }: { c: CreditCaseDto; onChange: () => void; standalone?: boolean }) {
  const toast = useToast();
  const d = c.disbursement;
  const [holderName, setHolderName] = useState(d?.holderName ?? '');
  const [cardNumber, setCardNumber] = useState(d?.cardNumber ?? '');
  const [accountNumber, setAccountNumber] = useState(d?.accountNumber ?? '');
  const [bankMfo, setBankMfo] = useState(d?.bankMfo ?? '');
  const [holderInn, setHolderInn] = useState(d?.holderInn ?? '');
  const [bankName, setBankName] = useState(d?.bankName ?? '');
  const filled = !!(d?.holderName || d?.cardNumber || d?.accountNumber);
  // On its own page it is always expanded; inside the case view it is collapsible.
  const [open, setOpen] = useState(standalone);

  const save = useMutation({
    mutationFn: () => api.saveDisbursement(c.id, {
      holderName: holderName.trim() || null,
      cardNumber: cardNumber.trim() || null,
      accountNumber: accountNumber.trim() || null,
      bankMfo: bankMfo.trim() || null,
      holderInn: holderInn.trim() || null,
      bankName: bankName.trim() || null,
    }),
    onSuccess: () => { onChange(); toast.success('Saqlandi', 'Pul ўtkazish rekvizitlari'); },
    onError: () => toast.error('Xatolik', 'Rekvizitlarni saqlab bo‘lmadi'),
  });

  return (
    <Card className="space-y-4">
      <button type="button" onClick={standalone ? undefined : () => setOpen((o) => !o)} className={cn('flex w-full items-start gap-3 text-left outline-none', standalone && 'cursor-default')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Banknote className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800 dark:text-white">Pul o‘tkazish rekvizitlari</h2>
            {filled && <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">to‘ldirilgan</span>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Buxgalteriya hujjatlariga kiradi — «Mablag‘ taqsimoti» va «Pul o‘tkazish arizasi». Hisob egasi qarz oluvchidan boshqa shaxs bo‘lishi mumkin.
          </p>
        </div>
        {!standalone && <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-gray-400 transition', open && 'rotate-180')} />}
      </button>

      {open && <>
      {/* Karta ma'lumotlari */}
      <div className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Karta ma'lumotlari</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Hisob egasi" className="sm:col-span-2"><Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="F.I.O" /></Field>
          <Field label="Karta raqami" className="sm:col-span-2" hint="16 raqam (4-4-4-4)">
            <Input inputMode="numeric" maxLength={19} value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} placeholder="0000 0000 0000 0000" className="tracking-[0.2em]" />
          </Field>
          <Field label="INN (STIR)" hint="9 raqam"><Input inputMode="numeric" maxLength={9} value={holderInn} onChange={(e) => setHolderInn(onlyDigits(e.target.value, 9))} placeholder="000000000" /></Field>
        </div>
      </div>

      {/* Bank / hisob ma'lumotlari */}
      <div className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Bank ma'lumotlari</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Hisob raqami (X/R)" className="sm:col-span-2" hint="20 raqam">
            <Input inputMode="numeric" maxLength={20} value={accountNumber} onChange={(e) => setAccountNumber(onlyDigits(e.target.value, 20))} placeholder="00000000000000000000" />
          </Field>
          <Field label="MFO" hint="5 raqam"><Input inputMode="numeric" maxLength={5} value={bankMfo} onChange={(e) => setBankMfo(onlyDigits(e.target.value, 5))} placeholder="00000" /></Field>
          <Field label="Bank nomi"><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank nomi" /></Field>
        </div>
      </div>

      <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Saqlash</Button>
      </>}
    </Card>
  );
}

