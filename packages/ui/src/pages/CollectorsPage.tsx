import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CollectorListItem } from '@credit-core/shared';
import { api, getErrorMessage } from '@credit-core/api-client';
import { Button, Field, Input, PasswordInput, Skeleton } from '../components/primitives';
import { MultiSelect, PhoneInput } from '../components/forms';
import { DataTable, type Column } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Plus, Edit, Copy, Check } from '../lib/icons';
import { cn } from '../lib/cn';

interface FormState {
  fullName: string;
  login: string;
  password: string;
  phone: string;
  branchIds: string[];
}
const emptyForm: FormState = { fullName: '', login: '', password: '', phone: '', branchIds: [] };

export function CollectorsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: collectors, isLoading } = useQuery({ queryKey: ['collectors'], queryFn: () => api.collectors() });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches() });

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirm, setConfirm] = useState<CollectorListItem | null>(null);

  const branchOpts = useMemo(() => (branches ?? []).map((b) => ({ value: b.id, label: `${b.symbol} — ${b.name}` })), [branches]);

  const openCreate = () => { setForm(emptyForm); setModal({ mode: 'create' }); };
  const openEdit = (c: CollectorListItem) => {
    setForm({ fullName: c.fullName, login: c.login, password: '', phone: c.phone ?? '', branchIds: c.branches.map((b) => b.id) });
    setModal({ mode: 'edit', id: c.id });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (modal?.mode === 'create') {
        return api.createCollector({
          fullName: form.fullName, login: form.login, password: form.password,
          phone: form.phone || null, branchIds: form.branchIds,
        });
      }
      return api.updateCollector(modal!.id!, {
        fullName: form.fullName, phone: form.phone || null, branchIds: form.branchIds,
        ...(form.password ? { password: form.password } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collectors'] });
      toast.success('Saqlandi', 'Undiruvchi ma’lumotlari yangilandi');
      setModal(null);
    },
    onError: (e) => toast.error('Xatolik', getErrorMessage(e)),
  });

  const toggleBlock = useMutation({
    mutationFn: (c: CollectorListItem) => api.updateCollector(c.id, { isActive: !c.isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['collectors'] }); setConfirm(null); toast.success('Bajarildi', 'Holat o‘zgardi'); },
    onError: (e) => toast.error('Xatolik', getErrorMessage(e)),
  });

  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast.success('Nusxalandi', text); };

  const columns: Column<CollectorListItem>[] = [
    {
      key: 'fullName', header: 'F.I.O', sortable: true, render: (c) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-xs font-semibold text-white">
            {c.fullName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </span>
          <span className="font-medium text-gray-800 dark:text-white">{c.fullName}</span>
        </div>
      ),
    },
    {
      key: 'login', header: 'Login / Parol', render: (c) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <button type="button" onClick={() => copy(c.login)} className="inline-flex items-center gap-1 text-gray-600 hover:text-brand-600 dark:text-gray-300">
            <Copy className="h-3 w-3" /> {c.login}
          </button>
          {c.plainPassword && (
            <button type="button" onClick={() => copy(c.plainPassword!)} className="inline-flex items-center gap-1 text-gray-400 hover:text-brand-600">
              <Copy className="h-3 w-3" /> {c.plainPassword}
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'branches', header: 'Filiallar', render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.branches.length === 0 && <span className="text-gray-400">—</span>}
          {c.branches.map((b) => (
            <span key={b.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">{b.symbol}</span>
          ))}
        </div>
      ),
    },
    { key: 'phone', header: 'Telefon', render: (c) => <span className="nums text-gray-600 dark:text-gray-300">{c.phone ?? '—'}</span> },
    {
      key: 'activeCount', header: 'Faol undiruv', align: 'right', sortable: true, sortValue: (c) => c.activeCount,
      render: (c) => <span className="nums font-medium text-gray-800 dark:text-white">{c.activeCount}</span>,
    },
    {
      key: 'isActive', header: 'Holat', render: (c) => (
        <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', c.isActive ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400' : 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400')}>
          {c.isActive ? 'Faol' : 'Bloklangan'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right', render: (c) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={(e) => { e.stopPropagation(); openEdit(c); }}><Edit className="h-4 w-4" /></Button>
          <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setConfirm(c); }}>
            {c.isActive ? 'Bloklash' : 'Faollash'}
          </Button>
        </div>
      ),
    },
  ];

  const canSave = form.fullName.trim() && form.login.trim().length >= 3 && (modal?.mode === 'edit' || form.password.length >= 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Undiruvchilar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Dala undiruvchilari — login/parol bilan mobil ilovaga kiradi</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Yangi undiruvchi</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (
        <DataTable columns={columns} rows={collectors ?? []} searchable searchFields={['fullName', 'login', 'phone']} empty="Undiruvchi yo‘q" />
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Yangi undiruvchi' : 'Undiruvchini tahrirlash'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Bekor</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!canSave}><Check className="h-4 w-4" /> Saqlash</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="F.I.O" required><Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Familiya Ism Sharif" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Login" required><Input value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} placeholder="login" disabled={modal?.mode === 'edit'} /></Field>
            <Field label={modal?.mode === 'edit' ? 'Yangi parol' : 'Parol'} required={modal?.mode === 'create'} hint={modal?.mode === 'edit' ? 'Bo‘sh qoldirsangiz o‘zgarmaydi' : undefined}>
              <PasswordInput value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••" />
            </Field>
          </div>
          <Field label="Telefon"><PhoneInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} /></Field>
          <Field label="Filiallar" hint="Undiruvchi qamragan filiallar">
            <MultiSelect value={form.branchIds} onChange={(v) => setForm((f) => ({ ...f, branchIds: v }))} options={branchOpts} placeholder="Filiallarni tanlang" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && toggleBlock.mutate(confirm)}
        title={confirm?.isActive ? 'Undiruvchini bloklash' : 'Undiruvchini faollashtirish'}
        message={confirm ? `${confirm.fullName} — ${confirm.isActive ? 'bloklansinmi?' : 'faollashtirilsinmi?'}` : ''}
        confirmLabel={confirm?.isActive ? 'Bloklash' : 'Faollash'}
        tone={confirm?.isActive ? 'danger' : 'primary'}
        loading={toggleBlock.isPending}
      />
    </div>
  );
}
