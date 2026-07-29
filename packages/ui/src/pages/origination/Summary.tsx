import { originationCalc, loanTypeFor, loanProductProfile, LoanProductKind, type LoanProduct, type ScorableCase, type UpsertCasePayload } from '@credit-core/shared';
import { Card } from '../../components/primitives';
import { ScorePanel } from '../../components/ScorePanel';
import { formatMoney } from '../../lib/cn';

/** Live, sticky affordability + economics summary shown beside the wizard. */
export function Summary({ form }: { form: UpsertCasePayload }) {
  const af = form.affordability;
  const ins = form.creditLine?.insurance;
  const collateralTotal = form.collaterals.reduce((s, c) => s + (c.agreedValue ?? 0), 0);
  const amountTotal = form.creditLine?.amountTotal ?? form.amount;
  const calc = originationCalc({
    mainActivityIncome: af?.mainActivityIncome, secondaryIncome: af?.secondaryIncome, familyIncome: af?.familyIncome, otherIncome: af?.otherIncome,
    utilitiesExpense: af?.utilitiesExpense, familyExpense: af?.familyExpense, otherExpense: af?.otherExpense, existingCreditBurden: af?.existingCreditBurden,
    newLoanPayment: form.creditLine?.tranche?.monthlyPayment,
    loanUnderPolicy: ins?.loanUnderPolicy, insuranceRate: ins?.insuranceRate, policyTermMonths: ins?.policyTermMonths,
    requiredInsuredAmount: form.creditLine?.requiredInsuredAmount,
    amountTotal, collateralTotal,
  });
  const loanType = loanTypeFor(amountTotal);
  // The 4 products ARE the credit type. Show the product; fall back to the micro label only for
  // legacy cases with no product.
  const product = (form.product ?? null) as LoanProduct | null;
  const typeLabel = product ? loanProductProfile(product).label.uz : loanType === 'MICROCREDIT' ? 'Mikrokredit' : 'Mikroqarz';
  // For asset products (AVTO/IPOTEKA) the asset IS the purchase — «garov qoplami» is meaningless.
  // Show the asset price and the derived down payment (price − loan) instead.
  const isAsset = product ? loanProductProfile(product).kind === LoanProductKind.ASSET : false;
  const assetPrice = form.collaterals?.[0]?.agreedValue ?? null;
  const downPayment = assetPrice != null && amountTotal != null ? Math.max(0, assetPrice - amountTotal) : null;
  const downPct = assetPrice && downPayment != null ? Math.round((downPayment / assetPrice) * 100) : null;

  const row = (label: string, value: string, danger = false) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`nums font-semibold ${danger ? 'text-error-600 dark:text-error-500' : 'text-gray-800 dark:text-white'}`}>{value}</span>
    </div>
  );

  return (
    <Card className="sticky top-4 space-y-0.5">
      <h3 className="mb-2 font-semibold text-gray-800 dark:text-white">Xulosa</h3>
      <div className="mb-2 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-500/10">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Kredit turi</span>
        <span className="text-base font-bold text-brand-700 dark:text-brand-400">{typeLabel}</span>
      </div>
      {row('Jami summa', amountTotal ? formatMoney(amountTotal) : '—')}
      {row('Transh muddati', form.creditLine?.tranche?.termMonths ? `${form.creditLine.tranche.termMonths} oy` : '—')}
      {row('Oylik to‘lov', form.creditLine?.tranche?.monthlyPayment ? formatMoney(form.creditLine.tranche.monthlyPayment) : '—')}
      {row('To‘lov kuni', form.creditLine?.tranche?.paymentDay ? `Har oyning ${form.creditLine.tranche.paymentDay}-kuni` : '—')}
      {row('Jami daromad', formatMoney(calc.totalIncome))}
      {row('Jami xarajat', formatMoney(calc.totalExpenses))}
      {/* DTI / Surplus / Min income only make sense once income is entered — otherwise Surplus just
          shows the negative monthly payment, which is confusing. */}
      {calc.totalIncome > 0 && (
        <>
          {row('Surplus', formatMoney(calc.surplus), calc.surplus < 0)}
          {row('Min kerakli daromad', formatMoney(calc.minRequiredIncome))}
        </>
      )}
      {row('Sug‘urta puli', formatMoney(calc.premium))}
      {isAsset
        ? <>
            {row('Aktiv qiymati', assetPrice ? formatMoney(assetPrice) : '—')}
            {row('Boshlang‘ich to‘lov', downPayment != null && downPct != null ? `${formatMoney(downPayment)} · ${downPct}%` : '—')}
          </>
        : row('Garov qoplami', amountTotal ? `${(calc.coverageRatio * 100).toFixed(0)}%` : '—')}
      {!calc.affordabilityOk && (calc.totalIncome > 0) && (
        <p className="mt-2 rounded-lg bg-error-50 px-3 py-2 text-xs font-medium text-error-700 dark:bg-error-600/10 dark:text-error-400">
          Daromad yetarli emas (surplus manfiy yoki 2.2× dan past) — ko‘rib chiqing.
        </p>
      )}

      <ScorePanel subject={form as unknown as ScorableCase} coverageRatio={calc.coverageRatio} collateralTotal={collateralTotal} collateralCount={form.collaterals.length} product={form.product ?? null} />
    </Card>
  );
}
