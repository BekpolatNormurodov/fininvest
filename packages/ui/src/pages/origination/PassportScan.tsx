import { useEffect, useState } from 'react';
import type { PassportScanResult } from '@credit-core/shared';
import { api, getErrorMessage } from '@credit-core/api-client';
import { Upload, Camera, IdCard, CheckCircle2, RotateCcw, Globe, Warning, ShieldCheck, Eye, X, FileText } from '../../lib/icons';
import { Button, Card, Field, Input } from '../../components/primitives';
import { Select, DatePicker } from '../../components/forms';
import { cn } from '../../lib/cn';

type Fields = PassportScanResult['fields'];

/** Below this check-digit confidence the read is untrustworthy — prompt a retake, don't prefill. */
const TRUST = 60;

const EMPTY: Fields = {
  fullName: '', passportSeries: '', passportNumber: '',
  birthDate: null, passportExpiry: null, gender: '', nationality: '', pinfl: '',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function tone(c: number) {
  if (c >= 90) return { ring: 'text-success-500', chip: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500', label: 'Aniq' };
  if (c >= 60) return { ring: 'text-warning-500', chip: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500', label: 'Tekshiring' };
  return { ring: 'text-error-500', chip: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500', label: 'Qayta oling' };
}

function ConfidenceRing({ value, className }: { value: number; className?: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative h-12 w-12 shrink-0" role="img" aria-label={`Ishonchlilik ${value}%`}>
      <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={r} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="4" fill="none" />
        <circle cx="24" cy="24" r={r} className={cn('transition-all duration-700 motion-reduce:transition-none', className)} stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

function ValidChip({ valid }: { valid?: boolean }) {
  if (valid === undefined) return null;
  return valid ? (
    <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-600 dark:bg-success-500/10 dark:text-success-500">✓ tekshirildi</span>
  ) : (
    <span className="rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] font-semibold text-error-600 dark:bg-error-500/10 dark:text-error-500">✗ nomuvofiq</span>
  );
}

function FieldWithChip({ label, valid, children }: { label: string; valid?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <ValidChip valid={valid} />
      </div>
      {children}
    </div>
  );
}

function ReadonlyRow({ label, value, valid }: { label: string; value: string; valid?: boolean }) {
  return (
    <FieldWithChip label={label} valid={valid}>
      <div className="flex h-11 items-center rounded-lg border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{value || '—'}</div>
    </FieldWithChip>
  );
}

/** Thumbnail of an uploaded image; click to view it full-size via `onView`. Revokes its object URL
 *  on unmount/replace. */
function Thumb({ file, label, onView }: { file: File; label: string; onView: (url: string, label: string) => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  return (
    <figure className="space-y-1">
      <button
        type="button"
        onClick={() => (isPdf ? window.open(url, '_blank', 'noopener') : onView(url, label))}
        className="group relative block w-full overflow-hidden rounded-lg border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:border-gray-700"
        aria-label={`${label} — to‘liq ko‘rish`}
      >
        {isPdf ? (
          <div className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-gray-50 px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <FileText className="h-8 w-8" />
            <span className="max-w-full truncate text-[11px]">{file.name}</span>
          </div>
        ) : (
          <>
            <img src={url} alt={label} className="h-28 w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 text-xs font-medium text-transparent transition group-hover:bg-black/45 group-hover:text-white">
              <Eye className="h-4 w-4" /> Ko‘rish
            </span>
          </>
        )}
      </button>
      <figcaption className="text-center text-[11px] text-gray-400">{label}</figcaption>
    </figure>
  );
}

/** Passport MRZ scanner — prefills the borrower form. Mounted in the origination borrower step. */
export function PassportScan({ onExtract, onSaveScan }: {
  onExtract: (patch: Partial<Fields>) => void;
  /** Called on confirm with the scanned image file(s) + the read passport number, to persist them. */
  onSaveScan?: (files: File[], passportNumber: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PassportScanResult | null>(null);
  const [form, setForm] = useState<Fields>(EMPTY);
  const [docType, setDocType] = useState<'PASSPORT' | 'ID'>('PASSPORT');
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const applyResult = (r: PassportScanResult) => {
    setResult(r);
    // Only prefill when the read is trustworthy; a low-confidence read is likely wrong (it may be
    // header/visa text misread as an MRZ), so we prompt a retake rather than seed the form with it.
    setForm(r.confidence >= TRUST ? r.fields : EMPTY);
  };

  const runScan = async (file: File) => {
    setPassportFile(file);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      applyResult(await api.scanPassport(file));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runIdScan = async (front: File, back: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      applyResult(await api.scanIdCard(front, back));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runScan(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) runScan(f);
  };

  const validOf = (key: string) => result?.perField.find((p) => p.key === key)?.valid;

  const confirm = () => {
    const patch: Partial<Fields> = {};
    if (form.fullName) patch.fullName = form.fullName;
    if (form.passportSeries) patch.passportSeries = form.passportSeries;
    if (form.passportNumber) patch.passportNumber = form.passportNumber;
    if (form.birthDate) patch.birthDate = form.birthDate;
    if (form.passportExpiry) patch.passportExpiry = form.passportExpiry;
    if (form.gender) patch.gender = form.gender;
    if (form.nationality) patch.nationality = form.nationality;
    if (form.pinfl) patch.pinfl = form.pinfl;
    if (form.placeOfBirth) patch.placeOfBirth = form.placeOfBirth;
    if (form.passportIssueDate) patch.passportIssueDate = form.passportIssueDate;
    if (form.passportIssuer) patch.passportIssuer = form.passportIssuer;
    onExtract(patch);
    // Persist the scanned image(s), linked to the passport number, for the case's passport section.
    const files = (docType === 'PASSPORT' ? [passportFile] : [idFront, idBack]).filter(Boolean) as File[];
    const passportNumber = [form.passportSeries, form.passportNumber].filter(Boolean).join('');
    if (files.length) onSaveScan?.(files, passportNumber);
    setResult(null);
  };

  const t = result ? tone(result.confidence) : null;
  const trusted = !!result && result.confidence >= TRUST;
  const expired = result?.warnings.includes('expired');
  const expiringSoon = result?.warnings.includes('expiring_soon');
  // One face of an ID card cannot carry both: the issue date is printed on the front, the issuing
  // authority on the back. Say which side is missing rather than leaving an empty field unexplained.
  const idOtherSideNeeded = result?.warnings.includes('id_other_side_needed');

  return (
    <Card className="space-y-4 border-brand-100 bg-brand-50/40 dark:border-brand-500/20 dark:bg-brand-500/5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><IdCard className="h-5 w-5" /></span>
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white">Passport / ID-karta skanerlash</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Passport asosiy sahifasi yoki ID-karta <b>orqa tomoni</b> (MRZ) — maydonlar avtomatik to‘ladi</p>
        </div>
      </div>

      {/* Document type: passport = one image; ID card = front + back. */}
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
        {(['PASSPORT', 'ID'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setDocType(d); setResult(null); setError(null); setForm(EMPTY); setPassportFile(null); setIdFront(null); setIdBack(null); }}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition', docType === d ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300')}
          >
            {d === 'PASSPORT' ? 'Passport' : 'ID-karta'}
          </button>
        ))}
      </div>

      {docType === 'PASSPORT' && (
        <>
          {/* Upload / drag-drop / camera zone. sr-only inputs stay keyboard-focusable. */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition duration-200 motion-reduce:transition-none focus-within:ring-2 focus-within:ring-brand-600/30',
              drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-300 hover:border-brand-400 dark:border-gray-700',
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm dark:bg-gray-800"><Upload className="h-5 w-5" /></span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Rasmni bu yerga tashlang yoki tanlang</span>
            <span className="text-xs text-gray-400">Rasm yoki PDF — MRZ qatorlari tekis va yorug‘ ko‘rinsin</span>
            <input type="file" accept="image/*,application/pdf" aria-label="Passport rasm/PDF yuklash" className="sr-only" onChange={onFile} />
          </label>

          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-50 focus-within:ring-2 focus-within:ring-brand-600/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 sm:hidden">
            <Camera className="h-4 w-4" /> Kamera bilan olish
            <input type="file" accept="image/*" capture="environment" aria-label="Kamera bilan passport olish" className="sr-only" onChange={onFile} />
          </label>
        </>
      )}

      {docType === 'ID' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([['Old tomon', idFront, setIdFront], ['Orqa tomon (MRZ)', idBack, setIdBack]] as const).map(([label, val, setter]) => (
              <label key={label} className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-3 py-5 text-center text-xs transition hover:border-brand-400 focus-within:ring-2 focus-within:ring-brand-600/30 dark:border-gray-700">
                <Upload className="h-5 w-5 text-brand-600" />
                <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
                <span className="max-w-full truncate text-gray-400">{val ? val.name : 'tanlang'}</span>
                <input type="file" accept="image/*,application/pdf" aria-label={`ID-karta ${label}`} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setter(f); e.target.value = ''; }} />
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">Kartani kadrni to‘ldirib, tekis va yorug‘ oling — mayda yoki qiyshiq surat yomon o‘qiladi.</p>
          <Button disabled={!idFront || !idBack || busy} onClick={() => idFront && idBack && runIdScan(idFront, idBack)}>
            <IdCard className="h-4 w-4" /> Skanerlash
          </Button>
        </div>
      )}

      {/* Uploaded image preview(s) — stay visible beside the extracted fields; click to view full-size. */}
      {(docType === 'PASSPORT' ? passportFile : idFront || idBack) && (
        <div className={cn('grid gap-3', docType === 'ID' ? 'grid-cols-2' : 'max-w-[220px] grid-cols-1')}>
          {docType === 'PASSPORT' && passportFile && <Thumb file={passportFile} label="Passport" onView={(url, label) => setLightbox({ url, label })} />}
          {docType === 'ID' && idFront && <Thumb file={idFront} label="Old tomon" onView={(url, label) => setLightbox({ url, label })} />}
          {docType === 'ID' && idBack && <Thumb file={idBack} label="Orqa tomon" onView={(url, label) => setLightbox({ url, label })} />}
        </div>
      )}

      {busy && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-white/70 px-4 py-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent motion-reduce:animate-none" />
          Skanerlanmoqda…
        </div>
      )}
      {error && <p role="alert" className="text-sm text-error-600 dark:text-error-500">{error}</p>}

      {result && t && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <ConfidenceRing value={result.confidence} className={t.ring} />
            <div>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', t.chip)}><ShieldCheck className="h-3.5 w-3.5" /> {t.label} · <span className="tabular-nums">{result.confidence}%</span></span>
              {result.confidence < 60 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Yorug‘roq joyda, tekis ushlab, MRZ (pastdagi qatorlar) to‘liq ko‘rinsin — qayta oling.</p>
              )}
            </div>
          </div>

          {!trusted && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setResult(null)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <RotateCcw className="h-4 w-4" /> Boshqa rasm bilan qayta urinish
              </button>
            </div>
          )}

          {trusted && (
          <>
          {(expired || expiringSoon) && (
            <div
              role="alert"
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                expired ? 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400' : 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
              )}
            >
              <Warning className="h-4 w-4 shrink-0" />
              {expired
                ? `Passport muddati o‘tgan${form.passportExpiry ? ` — ${fmtDate(form.passportExpiry)}` : ''}`
                : `Passport muddati tugayapti${form.passportExpiry ? ` — ${fmtDate(form.passportExpiry)}` : ''}`}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="F.I.O"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <FieldWithChip label="Pasport seriya" valid={validOf('documentNumberCheckDigit')}>
              <Input value={form.passportSeries} onChange={(e) => setForm({ ...form, passportSeries: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} placeholder="AA" />
            </FieldWithChip>
            <FieldWithChip label="Pasport raqami" valid={validOf('documentNumberCheckDigit')}>
              <Input inputMode="numeric" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value.replace(/\D/g, '').slice(0, 7) })} />
            </FieldWithChip>
            <FieldWithChip label="PINFL" valid={validOf('personalNumberCheckDigit')}>
              <Input inputMode="numeric" value={form.pinfl} onChange={(e) => setForm({ ...form, pinfl: e.target.value.replace(/\D/g, '').slice(0, 14) })} />
            </FieldWithChip>
            <Field label="Jinsi">
              <Select value={form.gender} onChange={(v) => setForm({ ...form, gender: v as Fields['gender'] })} options={[{ value: 'MALE', label: 'Erkak' }, { value: 'FEMALE', label: 'Ayol' }]} />
            </Field>
            <FieldWithChip label="Fuqarolik">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-600/30 dark:border-gray-700 dark:bg-gray-800">
                <Globe className="h-4 w-4 shrink-0 text-gray-400" />
                <input className="w-full bg-transparent text-sm text-gray-700 outline-none dark:text-gray-200" aria-label="Fuqarolik" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="O‘zbekiston Respublikasi" />
              </div>
            </FieldWithChip>
            <ReadonlyRow label="Tug‘ilgan sana" value={fmtDate(form.birthDate)} valid={validOf('birthDateCheckDigit')} />
            <ReadonlyRow label="Amal qilish muddati" value={fmtDate(form.passportExpiry)} valid={validOf('expirationDateCheckDigit')} />
            {/* ID-card only: present (even if empty) for an ID scan, absent for a passport. */}
            {form.placeOfBirth !== undefined && (
              <Field label="Tug‘ilgan joy"><Input value={form.placeOfBirth ?? ''} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} /></Field>
            )}
            {/*
              Editable, unlike the two rows above it. Those come out of the MRZ with a check digit;
              this one cannot — ICAO 9303 has no date of issue — so it is OCR of printed text and
              may well be empty or wrong. Read-only left the operator looking at a blank they could
              see on the card in their hand and had no way to enter.
            */}
            {form.passportIssueDate !== undefined && (
              <Field label="Berilgan sana">
                <DatePicker value={form.passportIssueDate ?? null} onChange={(iso) => setForm({ ...form, passportIssueDate: iso })} />
              </Field>
            )}
            {form.passportIssuer !== undefined && (
              <Field label="Pasport kim bergan"><Input value={form.passportIssuer ?? ''} onChange={(e) => setForm({ ...form, passportIssuer: e.target.value })} /></Field>
            )}
          </div>

          {result.unverifiedFields && result.unverifiedFields.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Ba’zi maydonlar rasmdan o‘qildi (check-digit yo‘q) — ✓ belgisiz maydonlarni tekshiring.</p>
          )}

          {idOtherSideNeeded && (
            <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              Bu — ID-karta. «Berilgan sana» kartaning old, «Kim bergan» esa orqa tomonida bosilgan,
              shuning uchun bitta rasmdan ikkalasi chiqmaydi. To‘liq to‘lishi uchun «ID-karta»
              bo‘limidan <b>ikkala tomonni</b> yuklang — yoki quyida qo‘lda kiriting.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={confirm}><CheckCircle2 className="h-4 w-4" /> Formani to‘ldirish</Button>
            <button type="button" onClick={() => setResult(null)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 outline-none transition hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:hover:text-gray-300">
              <RotateCcw className="h-4 w-4" /> Qayta
            </button>
          </div>
          </>
          )}
        </div>
      )}

      {/* Full-size image viewer — click anywhere / ✕ / Esc to close. */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${lightbox.label} — to‘liq ko‘rish`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/80 p-4 backdrop-blur-sm"
        >
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white outline-none transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox.url} alt={lightbox.label} onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl" />
          <span className="text-sm text-white/80">{lightbox.label}</span>
        </div>
      )}
    </Card>
  );
}
