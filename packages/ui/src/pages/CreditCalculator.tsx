import { useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { LOAN_PRODUCT_ORDER, loanProductProfile, type LoanProduct } from '@credit-core/shared';
import { Calculator, FileDown } from '../lib/icons';
import { Card, Field, Input } from '../components/primitives';
import { MoneyInput } from '../components/forms';
import { DataTable, type Column } from '../components/DataTable';
import { useTheme } from '../lib/theme';
import { formatMoney, cn } from '../lib/cn';
import { chartSeries, chartAxis } from '../lib/chartColors';

/** Themed donut tooltip (slice name + money). */
function CalcTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-theme-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      <p className="font-semibold text-gray-800 dark:text-white">{payload[0].name}</p>
      <p className="nums text-gray-500 dark:text-gray-400">{formatMoney(Number(payload[0].value))}</p>
    </div>
  );
}

interface Row { id: string; n: number; payment: number; principal: number; interest: number; balance: number }

function annuity(amount: number, annualRate: number, months: number): Row[] {
  const r = annualRate / 100 / 12;
  const pay = r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
  const rows: Row[] = [];
  let balance = amount;
  for (let n = 1; n <= months; n++) {
    const interest = balance * r;
    const principal = Math.min(pay - interest, balance);
    balance = Math.max(0, balance - principal);
    rows.push({ id: String(n), n, payment: principal + interest, principal, interest, balance });
  }
  return rows;
}

function differentiated(amount: number, annualRate: number, months: number): Row[] {
  const r = annualRate / 100 / 12;
  const principal = amount / months;
  const rows: Row[] = [];
  let balance = amount;
  for (let n = 1; n <= months; n++) {
    const interest = balance * r;
    balance = Math.max(0, balance - principal);
    rows.push({ id: String(n), n, payment: principal + interest, principal, interest, balance });
  }
  return rows;
}

export function CreditCalculator() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const series = chartSeries(dark);
  const { tick } = chartAxis(dark);
  const [amount, setAmount] = useState(100_000_000);
  const [rate, setRate] = useState(24);
  const [months, setMonths] = useState(18);
  const [method, setMethod] = useState<'annuity' | 'diff'>('annuity');
  const [product, setProduct] = useState<LoanProduct | null>(null);

  // Picking a credit type seeds its default rate and caps the term — both still editable after.
  const selectProduct = (p: LoanProduct) => {
    const pr = loanProductProfile(p);
    setProduct(p);
    setRate(pr.rateMinPct);
    setMonths((m) => Math.min(m || pr.maxTermMonths, pr.maxTermMonths));
  };

  const schedule = useMemo(
    () => (amount > 0 && months > 0 ? (method === 'annuity' ? annuity(amount, rate, months) : differentiated(amount, rate, months)) : []),
    [amount, rate, months, method],
  );
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalPay = schedule.reduce((s, r) => s + r.payment, 0);
  const firstPay = schedule[0]?.payment ?? 0;

  const columns: Column<Row>[] = [
    { key: 'n', header: '#', className: 'nums text-gray-500 dark:text-gray-400', render: (r) => r.n },
    { key: 'payment', header: 'To‘lov', align: 'right', className: 'nums font-medium', render: (r) => formatMoney(Math.round(r.payment)) },
    { key: 'principal', header: 'Asosiy qarz', align: 'right', className: 'nums', render: (r) => formatMoney(Math.round(r.principal)) },
    { key: 'interest', header: 'Foiz', align: 'right', className: 'nums', render: (r) => formatMoney(Math.round(r.interest)) },
    { key: 'balance', header: 'Qoldiq', align: 'right', className: 'nums text-gray-500 dark:text-gray-400', render: (r) => formatMoney(Math.round(r.balance)) },
  ];

  const pie = [
    { name: 'Asosiy qarz', value: amount, fill: series.brand },
    { name: 'Foiz (ustama)', value: Math.round(totalInterest), fill: series.warning },
  ];

  // Print a clean, self-contained schedule (no app chrome) via a new window.
  const printSchedule = () => {
    if (!schedule.length) return;
    const w = window.open('', '_blank', 'width=820,height=920');
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const title = product ? loanProductProfile(product).label.uz : 'Kredit';
    const rows = schedule
      .map((r) => `<tr><td>${r.n}</td><td class="r">${esc(formatMoney(Math.round(r.payment)))}</td><td class="r">${esc(formatMoney(Math.round(r.principal)))}</td><td class="r">${esc(formatMoney(Math.round(r.interest)))}</td><td class="r">${esc(formatMoney(Math.round(r.balance)))}</td></tr>`)
      .join('');
    w.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Kredit jadvali — ${esc(title)}</title>
<style>
  *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
  body{margin:28px;color:#111}
  h1{font-size:18px;margin:0 0 2px} .sub{color:#666;font-size:12px;margin:0 0 16px}
  .grid{display:flex;flex-wrap:wrap;gap:10px 28px;margin:0 0 16px;font-size:13px}
  .grid div span{color:#666} .grid div b{margin-left:6px}
  .stats{display:flex;gap:14px;margin:0 0 16px}
  .stat{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px}
  .stat p{margin:0} .stat .k{color:#666;font-size:11px;text-transform:uppercase} .stat .v{font-size:15px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #e5e7eb;padding:5px 8px;text-align:left} th{background:#f8fafc}
  td.r,th.r{text-align:right}
  @media print{body{margin:12mm}}
</style></head><body>
  <h1>Kredit kalkulyatori — ${esc(title)}</h1>
  <p class="sub">To'lov jadvali · FinInvest</p>
  <div class="grid">
    <div><span>Summa:</span><b>${esc(formatMoney(amount))}</b></div>
    <div><span>Yillik foiz:</span><b>${rate}%</b></div>
    <div><span>Muddat:</span><b>${months} oy</b></div>
    <div><span>Usul:</span><b>${method === 'annuity' ? 'Annuitet' : 'Differensial'}</b></div>
  </div>
  <div class="stats">
    <div class="stat"><p class="k">${method === 'annuity' ? 'Oylik to‘lov' : '1-oy to‘lovi'}</p><p class="v">${esc(formatMoney(Math.round(firstPay)))}</p></div>
    <div class="stat"><p class="k">Jami ustama</p><p class="v">${esc(formatMoney(Math.round(totalInterest)))}</p></div>
    <div class="stat"><p class="k">Jami to‘lov</p><p class="v">${esc(formatMoney(Math.round(totalPay)))}</p></div>
  </div>
  <table><thead><tr><th>#</th><th class="r">To'lov</th><th class="r">Asosiy qarz</th><th class="r">Foiz</th><th class="r">Qoldiq</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Calculator className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Kredit kalkulyatori</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">To‘lov jadvali va ustama hisobi</p>
        </div>
        <button type="button" onClick={printSchedule} disabled={!schedule.length}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
          <FileDown className="h-4 w-4" /> Chop etish
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-1">
          <Field label="Kredit turi" hint="default foiz va muddat qo‘yiladi">
            <div className="grid grid-cols-2 gap-2">
              {LOAN_PRODUCT_ORDER.map((p) => {
                const on = product === p;
                return (
                  <button key={p} type="button" onClick={() => selectProduct(p)} aria-pressed={on}
                    className={cn('rounded-lg border px-2.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                      on ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400'
                         : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5')}>
                    {loanProductProfile(p).label.uz}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Kredit summasi"><MoneyInput value={amount} onChange={(v) => setAmount(v ?? 0)} /></Field>
          <Field label="Yillik foiz stavkasi (%)"><Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} /></Field>
          <Field label="Muddat (oy)"><Input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value) || 0)} /></Field>
          <Field label="To‘lov usuli">
            <div className="flex gap-2">
              {(['annuity', 'diff'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${method === m ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5'}`}>
                  {m === 'annuity' ? 'Annuitet' : 'Differensial'}
                </button>
              ))}
            </div>
          </Field>
        </Card>

        <Card className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={method === 'annuity' ? 'Oylik to‘lov' : '1-oy to‘lovi'} value={formatMoney(Math.round(firstPay))} tone="text-brand-700 dark:text-brand-400" />
            <Stat label="Jami ustama (foiz)" value={formatMoney(Math.round(totalInterest))} tone="text-warning-600 dark:text-warning-500" />
            <Stat label="Jami to‘lov" value={formatMoney(Math.round(totalPay))} tone="text-gray-800 dark:text-white" />
          </div>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pie.map((p) => <Cell key={p.name} fill={p.fill} />)}
                </Pie>
                <Tooltip content={<CalcTip />} />
                <Legend wrapperStyle={{ fontSize: 13, color: tick }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <DataTable columns={columns} rows={schedule} pageSize={12} empty="Qiymatlarni kiriting" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`nums text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}
