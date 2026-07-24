import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Calculator, Download, Eye, FileText, Lock, ShieldCheck, Trash2, Upload,
} from '../lib/icons';
import { api, downloadBlob, viewDocument, documentInlineUrl, getErrorMessage, type CaseDocumentMeta } from '@credit-core/api-client';
import { CaseStatus, DocumentType, DOCUMENT_LABEL, Role, type DocumentDto, PRODUCT_LABEL, productExtraDocs } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Card, Skeleton, StatusBadge } from '../components/primitives';
import { Select } from '../components/forms';
import { useToast } from '../components/Toast';
import { cn } from '../lib/cn';

// Per-document status pill: grey while under review → green once the director signs → red if refused.
const BADGE_TONE: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  approved: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
  rejected: 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400',
};

// Same set offered on the case-overview upload control — kept identical so a document filed here
// lands in the same place it would have from the old modal.
const uploadTypes: DocumentType[] = [
  DocumentType.PASSPORT, DocumentType.NOTARY, DocumentType.SCAN, DocumentType.COLLATERAL_PHOTO, DocumentType.TECH_PASSPORT,
];

/**
 * Dedicated documents page for one case — replaces the old cramped `DocumentsPanel` modal.
 * Three sections:
 *  1. «Umumiy hujjatlar»          — generated registry docs (category 'main').
 *  2. «Notarius uchun hujjatlar»  — the 3 notary copies (category 'notary'), kept apart on purpose.
 *  3. «Qo'shimcha hujjatlar»      — operator-attached uploads (not tied to a collateral).
 * Each generated doc now carries a `stage` ('review' | 'approved') from the backend and an
 * `available` flag computed from stage + case status — documents that only make sense after the
 * director approves (notary copies, monitoring acts) render locked/greyed until then. This page
 * owns its own upload state; it does not share any state with CaseView.
 */
export function CaseDocumentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<DocumentType>(DocumentType.NOTARY);

  const { data: c, isLoading } = useQuery({ queryKey: ['case', id], queryFn: () => api.case(id!) });
  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['case-docs', id],
    queryFn: () => api.listCaseDocuments(id!),
    enabled: !!c && c.status !== CaseStatus.DRAFT,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['case', id] });
    qc.invalidateQueries({ queryKey: ['case-docs', id] });
  };
  const upload = useMutation({
    mutationFn: ({ file, type }: { file: File; type: DocumentType }) => api.uploadDocument(id!, type, file),
    onSuccess: () => { refresh(); toast.success('Hujjat yuklandi'); },
    onError: (err) => toast.error('Xatolik', getErrorMessage(err)),
  });

  const openGenerated = async (key: string) => {
    const url = URL.createObjectURL(await api.caseDocumentBlob(id!, key));
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (isLoading || !c) return <CaseDocumentsPageSkeleton />;

  const role = user!.role;
  const isArchived = !!c.deletedAt;
  // Same authorization as the case-overview upload control: any authenticated role may attach a
  // document while the case is not archived.
  const canUpload = !isArchived;
  const canManageDocs = canUpload || role === Role.ADMIN;
  const isDirectorReview = role === Role.DIRECTOR && c.status === CaseStatus.DIRECTOR_REVIEW;
  const currentUploadTypes = isDirectorReview ? [DocumentType.DIRECTOR_FINAL] : uploadTypes;
  const effectiveUploadType = currentUploadTypes.includes(uploadType) ? uploadType : currentUploadTypes[0];

  const generalDocs = c.documents.filter((d) => !d.collateralId);
  const mainDocs = docs?.filter((d) => d.category === 'main') ?? [];
  const notaryDocs = docs?.filter((d) => d.category === 'notary') ?? [];
  const accountantDocs = docs?.filter((d) => d.category === 'accountant') ?? [];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          // Pop history back to the ariza detail we came from — pushing a fresh /cases/:id entry
          // instead would leave a duplicate on the stack, so the detail page's own "Orqaga" would
          // send the user right back into documents. Fall back to the case page on a deep-link/refresh
          // where there's no in-app history to pop (react-router tracks position in history.state.idx).
          const st = window.history.state as { idx?: number } | null;
          if (st && typeof st.idx === 'number' && st.idx > 0) navigate(-1);
          else navigate(`/cases/${c.id}`);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-gray-500 outline-none transition hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
      >
        <ArrowRight className="h-4 w-4 rotate-180" /> Arizaga qaytish
      </button>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Hujjatlar</h1>
          <StatusBadge status={c.status} />
        </div>
        <p className="nums text-sm text-gray-500 dark:text-gray-400">
          {c.contractNumber ?? c.number} · {c.borrower?.fullName ?? '—'}
          <span className="text-gray-400 dark:text-gray-500"> · {PRODUCT_LABEL[c.productType]}</span>
        </p>
      </div>

      {c.product && productExtraDocs(c.product).length > 0 && (
        <Card className="space-y-2 border-brand-200 bg-brand-50/40 dark:border-brand-500/20 dark:bg-brand-500/5">
          <SectionHeading title="Kutilayotgan hujjatlar (asset kredit)" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bu hujjatlar tashqi tomondan tayyorlanadi (notarius / kadastr / sug‘urta kompaniyasi) va «Qo‘shimcha hujjatlar» bo‘limiga yuklanadi.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {productExtraDocs(c.product).map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                  <FileText className="h-3 w-3" />
                </span>
                {d.title.uz}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <SectionHeading title="Umumiy hujjatlar" hint={c.status !== CaseStatus.DRAFT ? `${mainDocs.length} ta` : undefined} />
        {c.status === CaseStatus.DRAFT ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Ariza yuborilgach hujjatlar shakllanadi.</p>
        ) : docsLoading ? (
          <DocListSkeleton />
        ) : mainDocs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Hujjat yo‘q</p>
        ) : (
          <GeneratedDocList docs={mainDocs} number={c.number} onOpen={openGenerated} caseId={c.id} />
        )}
      </Card>

      {c.status !== CaseStatus.DRAFT && (
        <Card className="space-y-3 border-brand-200 bg-brand-50/30 dark:border-brand-500/20 dark:bg-brand-500/5">
          <SectionHeading title="Buxgalteriya uchun hujjatlar" hint={`${accountantDocs.length} ta`} icon={Calculator} accent="brand" />
          <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
            Mablag‘ taqsimoti va pul o‘tkazish (karta) rekvizitlari — «Pul o‘tkazish rekvizitlari» bo‘limida to‘ldiriladi.
          </p>
          {docsLoading ? (
            <DocListSkeleton />
          ) : accountantDocs.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Hujjat yo‘q</p>
          ) : (
            <GeneratedDocList docs={accountantDocs} number={c.number} onOpen={openGenerated} caseId={c.id} />
          )}
        </Card>
      )}

      {c.status !== CaseStatus.DRAFT && (
        <Card className="space-y-3 border-warning-200 bg-warning-50/30 dark:border-warning-500/20 dark:bg-warning-500/5">
          <SectionHeading title="Notarius uchun hujjatlar" hint={`${notaryDocs.length} ta`} icon={ShieldCheck} accent="warning" />
          {docsLoading ? (
            <DocListSkeleton />
          ) : notaryDocs.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Hujjat yo‘q</p>
          ) : (
            <GeneratedDocList docs={notaryDocs} number={c.number} onOpen={openGenerated} caseId={c.id} />
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <SectionHeading
          title="Qo‘shimcha hujjatlar"
          hint={`${generalDocs.length} ta`}
        />
        <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
          Garovga bog‘lanmagan, operator tomonidan biriktirilgan hujjatlar (garov hujjatlari ariza sahifasida, har bir garov ostida).
        </p>

        {generalDocs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Hujjatlar yo‘q</p>
        ) : (
          <UploadedDocGrid docs={generalDocs} canManage={canManageDocs} caseId={c.id} />
        )}

        {canUpload && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <div className="w-52">
              <Select<DocumentType>
                value={effectiveUploadType}
                onChange={(v) => setUploadType(v)}
                options={currentUploadTypes.map((t) => ({ value: t, label: DOCUMENT_LABEL[t] }))}
              />
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate({ file: e.target.files[0], type: effectiveUploadType })} />
            <Button variant="secondary" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              <Upload className="h-5 w-5" /> Hujjat yuklash
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function SectionHeading({
  title, hint, icon: Icon, accent,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: 'warning' | 'brand';
}) {
  const iconColor = accent === 'brand'
    ? 'text-brand-600 dark:text-brand-400'
    : 'text-warning-600 dark:text-warning-500';
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />}
      <h2 className="font-semibold text-gray-800 dark:text-white">{title}</h2>
      {hint && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-300">{hint}</span>}
    </div>
  );
}

function DocListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
    </div>
  );
}

/** Row list for generated (registry) documents — shared by the Umumiy and Notarius sections. */
function GeneratedDocList({
  docs, number, caseId, onOpen,
}: {
  docs: CaseDocumentMeta[];
  number: string;
  caseId: string;
  onOpen: (key: string) => void;
}) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {docs.map((d) => (
        <li key={d.key} className={cn('flex items-center justify-between gap-3 py-2.5', !d.available && 'opacity-60')}>
          <div className="min-w-0">
            <p className={cn('truncate text-sm font-medium', d.available ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}>{d.title}</p>
            {!d.available ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Lock className="h-3 w-3 shrink-0" /> Direktor tasdiqlagach mavjud bo‘ladi
              </p>
            ) : d.badge && (
              <span className={cn('mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', BADGE_TONE[d.badge.tone])}>{d.badge.label}</span>
            )}
          </div>
          {d.available ? (
            <div className="flex shrink-0 gap-2">
              <button onClick={() => onOpen(d.key)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"><Eye className="h-3.5 w-3.5" /> Ko‘rish</button>
              <button onClick={async () => downloadBlob(await api.caseDocumentBlob(caseId, d.key), `${d.key}_${number}.pdf`)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:border-gray-700 dark:text-brand-400 dark:hover:bg-brand-500/10"><Download className="h-3.5 w-3.5" /> Yuklab olish</button>
            </div>
          ) : (
            <span className="shrink-0 text-xs text-gray-300 dark:text-gray-600">—</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Image thumbnails + file rows for the operator-uploaded "Qo'shimcha hujjatlar" section. */
function UploadedDocGrid({ docs, canManage, caseId }: { docs: DocumentDto[]; canManage: boolean; caseId: string }) {
  const images = docs.filter((d) => (d.mimeType ?? '').startsWith('image/'));
  const files = docs.filter((d) => !(d.mimeType ?? '').startsWith('image/'));
  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((d) => <UploadedImgThumb key={d.id} doc={d} canManage={canManage} caseId={caseId} />)}
        </div>
      )}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="flex min-w-0 items-center gap-2.5 text-sm">
                <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-700 dark:text-gray-200">{DOCUMENT_LABEL[d.type]} <span className="font-normal text-gray-400 dark:text-gray-500">· {d.fileName}</span></p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(d.uploadedAt).toLocaleString('ru-RU')}
                    {d.uploadedByName ? ` · ${d.uploadedByName}` : ''}
                  </p>
                </div>
              </div>
              <UploadedDocActions doc={d} canManage={canManage} caseId={caseId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** View / download + (when allowed) replace / delete a document file row — this page's own copy. */
function UploadedDocActions({ doc, canManage, caseId }: { doc: DocumentDto; canManage: boolean; caseId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const replaceRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['case', caseId] });
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

/** Image thumbnail with view + (when allowed) a delete overlay — this page's own copy. */
function UploadedImgThumb({ doc, canManage, caseId }: { doc: DocumentDto; canManage: boolean; caseId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({ mutationFn: () => api.deleteDocument(doc.id), onSuccess: () => { toast.success('O‘chirildi'); qc.invalidateQueries({ queryKey: ['case', caseId] }); }, onError: () => toast.error('Xatolik', 'O‘chirib bo‘lmadi') });
  const caption = doc.title ?? DOCUMENT_LABEL[doc.type];
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <button onClick={() => viewDocument(doc.id, doc.fileName)} aria-label={`${caption} · ${doc.fileName}`} title={`${caption} · ${doc.fileName}`} className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30">
        <img src={documentInlineUrl(doc.id)} alt={doc.fileName} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
      </button>
      {caption && <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{caption}</span>}
      {canManage && (
        <button onClick={() => del.mutate()} disabled={del.isPending} aria-label="O‘chirish" title="O‘chirish" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition hover:bg-error-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

/** Structural placeholder while the case loads. */
function CaseDocumentsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Yuklanmoqda">
      <Skeleton className="h-7 w-32" />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </Card>
      ))}
    </div>
  );
}
