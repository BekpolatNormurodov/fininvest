import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Plus, Trash2, House, Car, IdCard, Hashtag, Location,
  Money, Clock, Ruler, Tag, Calendar, Palette, Upload, FileText, Check,
} from '../lib/icons';
import { ProductType, DocumentType, type CollateralDto, type CollateralField } from '@credit-core/shared';
import { Button, Card, Field, Input } from '../components/primitives';
import { MoneyInput, DatePicker, PassportInput, PlateInput, KadastrInput, Select, digitsOnly } from '../components/forms';
import { CAR_MODELS } from '../lib/cars';
import { CAR_COLORS } from '../lib/colors';
import { TexScan } from './origination/TexScan';
import { cn } from '../lib/cn';

const num = (v: string): number | null => (v === '' ? null : Number(v));

// Full cadastre number, e.g. "10:01:05:03:01:1234".
const KADASTR_FULL = /^\d{2}:\d{2}:\d{2}:\d{2}:\d{2}:\d{3,4}$/;

/**
 * Kadastr agency lookup card — a dropdown-style card under the cadastre number. Shown once the
 * number is fully typed, with a green check. Currently a SIMULATION (fields are placeholders);
 * a real POST /api/kadastr/check to the Kadastr Agency will populate it later ("yaqinda").
 */
function KadastrCard({ cadastreNo }: { cadastreNo: string }) {
  if (!KADASTR_FULL.test((cadastreNo ?? '').trim())) return null;
  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
      <span className="nums text-xs font-medium text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
  return (
    <div className="-mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-white/5 sm:col-span-2">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"><FileText className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white">
            Hujjat va ma'lumotlar
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-600 text-white"><Check className="h-3 w-3" /></span>
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Kadastr agentligi · <span className="rounded bg-amber-50 px-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">yaqinda</span>
          </p>
        </div>
      </div>
      <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
        {row('Turi', '—')}
        {row('Manzil', '—')}
        {row('Maydon (m²)', '—')}
        {row('Holati', '—')}
      </div>
    </div>
  );
}

// A per-collateral staged attachment (image/file + name + free text), bound by collateral index.
export type StagedColDoc = { localId: string; colIndex: number; file: File; type: DocumentType; title: string; description: string };

export function CollateralCard({ index, c, errors, onChange, onRemove, canRemove, docs, onAddDocs, onRemoveDoc, onSetDocField, hideDocs = false, isPurchase = false, firmNew = false, mediaSlot, texSlot, borrowerName }: {
  index: number; c: CollateralDto; errors?: Partial<Record<CollateralField, string>>; onChange: (p: Partial<CollateralDto>) => void; onRemove: () => void; canRemove: boolean;
  docs: StagedColDoc[]; onAddDocs: (files: FileList | File[] | null) => void; onRemoveDoc: (localId: string) => void;
  onSetDocField: (localId: string, patch: Partial<Pick<StagedColDoc, 'title' | 'description'>>) => void;
  /** In the wizard, photos/videos are attached in the case view after saving (needs a collateral id). */
  hideDocs?: boolean;
  /** Asset-purchase products: the buyer (borrower) becomes the owner, so the pledge-owner block is hidden. */
  isPurchase?: boolean;
  /** New asset bought from a firm: plate number & tex-passport come only after registration, so they
   *  aren't required yet; a new car's mileage defaults to 0 with a «yangi» badge. */
  firmNew?: boolean;
  /** When provided (wizard), replaces the staged doc block with a working media uploader. */
  mediaSlot?: ReactNode;
  /** When provided (wizard, AUTO), the tex-passport scanner — so it can also save the scanned images. */
  texSlot?: ReactNode;
  /** Borrower name, so the card can say who owns the property when no owner is entered. */
  borrowerName?: string | null;
}) {
  const isAuto = c.type === ProductType.AUTO;
  const setOwners = (owners: CollateralDto['owners']) => onChange({ owners });
  const docRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // A brand-new car from a firm starts at 0 km — seed it once so the «yangi» badge shows.
  useEffect(() => {
    if (firmNew && isAuto && c.mileage == null) onChange({ mileage: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmNew, isAuto]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-white', isAuto ? 'bg-warning-600' : 'bg-brand-700')}>
            {isAuto ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
          </span>
          <h3 className="font-semibold text-gray-800 dark:text-white">{isPurchase ? `Sotib olinayotgan ${isAuto ? 'mashina' : 'uy-joy'}` : `Garov ${index + 1} — ${isAuto ? 'Avtotransport' : `Uy-joy · ${(c.realtyKind ?? 'APARTMENT') === 'HOUSE' ? 'Hovli' : 'Kvartira'}`}`}</h3>
        </div>
        {canRemove && <Button variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /> O'chirish</Button>}
      </div>

      {isAuto ? (
        <>
        {texSlot ?? <TexScan storeKey={`tex:col:${index}`} onExtract={onChange} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model (markasi)" required icon={Car} error={errors?.model}>
            <Select<string> value={c.model ?? ''} onChange={(v) => onChange({ model: v })} searchable placeholder="— mashinani tanlang —"
              options={CAR_MODELS.map((m) => ({ value: m, label: m }))} />
          </Field>
          <Field label="Davlat raqami" required={!firmNew} icon={Hashtag} error={errors?.stateNumber} hint={firmNew ? "ro'yxatdan o'tgach" : undefined}><PlateInput value={c.stateNumber ?? null} onChange={(v) => onChange({ stateNumber: v })} /></Field>
          <Field label="Tex passport (AAS №)" required={!firmNew} icon={IdCard} error={errors?.techPassportNo} hint={firmNew ? "ro'yxatdan o'tgach" : undefined}><Input value={c.techPassportNo ?? ''} onChange={(e) => onChange({ techPassportNo: e.target.value })} /></Field>
          <Field label="Kuzov turi" icon={Car}><Input value={c.bodyType ?? ''} onChange={(e) => onChange({ bodyType: e.target.value })} placeholder="YENGIL SEDAN" /></Field>
          <Field label="Kuzov №" icon={Hashtag}><Input value={c.bodyNo ?? ''} onChange={(e) => onChange({ bodyNo: e.target.value })} /></Field>
          <Field label="Dvigatel №" icon={Hashtag}><Input value={c.engineNo ?? ''} onChange={(e) => onChange({ engineNo: e.target.value })} /></Field>
          <Field label="Shassi" icon={Hashtag}><Input value={c.chassis ?? ''} onChange={(e) => onChange({ chassis: e.target.value })} /></Field>
          <Field label="Rang" icon={Palette}>
            <Select<string> value={c.color ?? ''} onChange={(v) => onChange({ color: v })} searchable placeholder="— rang tanlang —"
              options={CAR_COLORS.map((col) => ({ value: col.name, label: col.name, swatch: col.hex }))} />
          </Field>
          <Field label="Yil" icon={Calendar}><Input type="number" value={c.year ?? ''} onChange={(e) => onChange({ year: num(e.target.value) })} /></Field>
          <Field label="Probeg (km)" icon={Clock}>
            <div className="relative">
              <Input type="number" value={c.mileage ?? ''} onChange={(e) => onChange({ mileage: num(e.target.value) })} />
              {c.mileage === 0 && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">yangi</span>}
            </div>
          </Field>
        </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* Uy-joy turi: Kvartira (apartment) yoki Hovli (house) — maydonlar shунга qarab o'zgaradi. */}
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
            {([['APARTMENT', 'Kvartira'], ['HOUSE', 'Hovli']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => onChange({ realtyKind: k })}
                className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition', (c.realtyKind ?? 'APARTMENT') === k ? 'bg-brand-700 text-white' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manzil" required className="sm:col-span-2" icon={Location} error={errors?.address}><Input value={c.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} /></Field>
            <Field label="Reestr №" icon={Hashtag}><Input value={c.registryNo ?? ''} onChange={(e) => onChange({ registryNo: e.target.value })} /></Field>
            <Field label="Kadastr №" required icon={Hashtag} hint="10:01:05:03:01:1234" error={errors?.cadastreNo}><KadastrInput value={c.cadastreNo ?? null} onChange={(v) => onChange({ cadastreNo: v })} /></Field>
            <KadastrCard cadastreNo={c.cadastreNo ?? ''} />
            <Field label="Mulk turi" icon={House}><Input value={c.propertyType ?? ''} onChange={(e) => onChange({ propertyType: e.target.value })} placeholder={(c.realtyKind ?? 'APARTMENT') === 'HOUSE' ? "YAKKA TARTIBDAGI TURAR JOY" : "KO'P QAVATLI UYDAGI XONADON"} /></Field>
            <Field label="Ko'chirma sanasi" icon={Calendar}><DatePicker value={c.registrationDate ?? null} onChange={(iso) => onChange({ registrationDate: iso })} /></Field>
            {(c.realtyKind ?? 'APARTMENT') === 'HOUSE' && (
              <Field label="Yer maydoni (m²)" icon={Ruler}><Input type="number" value={c.landAreaM2 ?? ''} onChange={(e) => onChange({ landAreaM2: num(e.target.value) })} /></Field>
            )}
            <Field label={(c.realtyKind ?? 'APARTMENT') === 'HOUSE' ? 'Umumiy maydon, tashqi (m²)' : 'Umumiy maydon (m²)'} icon={Ruler}><Input type="number" value={c.totalAreaM2 ?? ''} onChange={(e) => onChange({ totalAreaM2: num(e.target.value) })} /></Field>
            {(c.realtyKind ?? 'APARTMENT') === 'HOUSE' && (
              <Field label="Foydali maydon (m²)" icon={Ruler}><Input type="number" value={c.usableAreaM2 ?? ''} onChange={(e) => onChange({ usableAreaM2: num(e.target.value) })} /></Field>
            )}
            <Field label="Yashash maydoni (m²)" icon={Ruler}><Input type="number" value={c.livingAreaM2 ?? ''} onChange={(e) => onChange({ livingAreaM2: num(e.target.value) })} /></Field>
            {(c.realtyKind ?? 'APARTMENT') !== 'HOUSE' && (
              <Field label="Xonalar nomi" icon={Tag}><Input value={c.roomNames ?? ''} onChange={(e) => onChange({ roomNames: e.target.value })} /></Field>
            )}
            <Field label="Xonalar soni" icon={Hashtag}><Input type="number" value={c.roomCount ?? ''} onChange={(e) => onChange({ roomCount: num(e.target.value) })} /></Field>
          </div>
        </div>
      )}

      <div className="grid gap-4 border-t border-gray-200 pt-4 dark:border-gray-800 sm:grid-cols-2">
        <Field label={isPurchase ? 'Kelishilgan summa (narx)' : 'Kelishilgan garov qiymati'} required icon={Money} error={errors?.agreedValue}><MoneyInput value={c.agreedValue ?? null} onChange={(v) => onChange({ agreedValue: v })} /></Field>
        {!isPurchase && <Field label="Qiymat (prописью)" icon={Tag}><Input value={c.agreedValueWords ?? ''} onChange={(e) => onChange({ agreedValueWords: e.target.value })} /></Field>}
      </div>

      {!isPurchase && (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Egalik huquqi (3 shaxsgacha)</h4>
          <Button variant="secondary" onClick={() => c.owners.length < 3 && setOwners([...c.owners, { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, sharePercent: null }])}>
            <Plus className="h-4 w-4" /> Egasi
          </Button>
        </div>

        {/*
          Empty is the normal case — the borrower pledging their own property — and it used to look
          like an unfilled field. Name who the documents will print, so leaving it empty is a
          decision rather than an oversight. Red only when there is no borrower name to fall back
          on, which is the one case that really does block signing.
        */}
        {!c.owners.some((o) => o.fullName.trim()) && (
          borrowerName?.trim() ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
              Egasi kiritilmagan — hujjatlarda <b className="text-gray-800 dark:text-white">{borrowerName}</b> (qarz
              oluvchining o‘zi, 100%) mulk egasi sifatida chiqadi. Boshqa shaxs bo‘lsa «Egasi» tugmasi bilan qo‘shing.
            </p>
          ) : (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              Mulk egasi aniqlanmadi — egasini kiriting yoki qarz oluvchining F.I.Sh. sini to‘ldiring.
              Hujjatlarda mulk egasi bo‘sh qoladi.
            </p>
          )
        )}
        {c.owners.map((o, idx) => (
          <div key={idx} className="grid gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800 sm:grid-cols-4">
            <Input placeholder="F.I.O" value={o.fullName} onChange={(e) => { const owners = [...c.owners]; owners[idx] = { ...o, fullName: e.target.value }; setOwners(owners); }} />
            <PassportInput value={o.passportNumber ?? null} onChange={(v) => { const owners = [...c.owners]; owners[idx] = { ...o, passportNumber: v }; setOwners(owners); }} />
            <Input placeholder="Ulush %" type="number" min={0} max={100} value={o.sharePercent ?? ''} onChange={(e) => { const owners = [...c.owners]; owners[idx] = { ...o, sharePercent: Math.min(100, Number(digitsOnly(e.target.value, 3)) || 0) || null }; setOwners(owners); }} />
            <Button variant="ghost" aria-label="Egasini o'chirish" onClick={() => setOwners(c.owners.filter((_, x) => x !== idx))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      )}

      {/* Wizard: a working per-collateral media uploader (mediaSlot). Elsewhere: the staged doc block. */}
      {mediaSlot ? (
        mediaSlot
      ) : hideDocs ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-200">Rasm / video:</span> arizani saqlagach, garov bo‘limida biriktiriladi — ixtiyoriy, ko‘pi <b>10 ta</b> (rasm yoki video).
        </div>
      ) : (
      <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white"><FileText className="h-4 w-4 text-gray-400" /> Qo'shimcha rasm va izohlar</h4>
        <input ref={docRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" multiple className="hidden" onChange={(e) => { onAddDocs(e.target.files); e.target.value = ''; }} />
        <button
          type="button"
          onClick={() => docRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onAddDocs(e.dataTransfer.files); }}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center outline-none transition hover:border-brand-400 hover:bg-brand-50/50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700 dark:bg-white/5 dark:hover:border-brand-500"
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Rasm yoki hujjat tashlang, yoki tanlang</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, PDF, DOC · har biriga nom va izoh yozish mumkin</span>
        </button>
        {docs.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map((d) => {
              const isImg = d.file.type.startsWith('image/');
              const url = isImg ? URL.createObjectURL(d.file) : null;
              return (
                <div key={d.localId} className="flex gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  {isImg && url ? (
                    <button type="button" onClick={() => setLightbox(url)} className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30" aria-label="Rasmni kattalashtirish">
                      <img src={url} alt={d.file.name} className="h-16 w-16 rounded-lg object-cover" />
                    </button>
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-500"><FileText className="h-6 w-6" /></span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Input value={d.title} onChange={(e) => onSetDocField(d.localId, { title: e.target.value })} placeholder="Nomi (masalan: Old tomondan)" />
                    <Input value={d.description} onChange={(e) => onSetDocField(d.localId, { description: e.target.value })} placeholder="Izoh matni (ixtiyoriy)" />
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{d.file.name}</p>
                  </div>
                  <Button variant="ghost" aria-label="Hujjatni o'chirish" className="shrink-0 px-2 text-error-600 dark:text-error-500" onClick={() => onRemoveDoc(d.localId)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
      {lightbox && (
        <div onClick={() => setLightbox(null)} role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </Card>
  );
}
