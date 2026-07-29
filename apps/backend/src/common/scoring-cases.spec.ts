import { scoreForCase, verdictFor, SCORE_VERDICT_LABEL, AGE_MIN, AGE_MAX } from '@credit-core/shared';

/**
 * A sweep across the case shapes that actually turn up, not just the happy one.
 *
 * The per-case totals are recorded so a change in any band shows up as a diff here rather than
 * silently moving every applicant's score; the invariants below hold for all of them.
 */
const yearsAgo = (n: number) => new Date(Date.now() - n * 365.25 * 24 * 3600 * 1000);

const strong = () => ({
  borrower: {
    fullName: 'A A', gender: 'FEMALE', birthDate: yearsAgo(45), education: 'Олий',
    maritalStatus: 'турмуш курган', familySize: 2, regTenure: 'иное (бошқа)',
    ownsHome: 'мулкий хукук', depositsBand: '3000$+',
  },
  employment: { sectorRiskCode: 5, position: 'Рахбарият', experienceBand: '3-5 лет' },
  affordability: {
    mainActivityIncome: 20_000_000, secondaryIncome: 0, utilitiesExpense: 500_000,
    familyExpense: 0, otherExpense: 0, newLoanPayment: 5_000_000, existingCreditBurden: 0,
  },
  creditHistory: {
    activeLoansCount: 0, overdueSubstandardFlag: 0, otherObligations: 0,
    loansOver5MFlag: 'Мавжуд эмас', priorMfiPawnshopFlag: 'Мавжуд эмас',
  },
  collaterals: [{ type: 'REAL_ESTATE', owners: [] }],
});
const withCase = (over: Record<string, unknown>) => scoreForCase({ ...strong(), ...over } as never);

describe('scoring across real case shapes', () => {
  const cases: [string, Record<string, unknown>, number, string][] = [
    ['property, fully filled', {}, 95, 'APPROVED'],
    ['vehicle pledge scores 2 lower', { collaterals: [{ type: 'AUTO', owners: [] }] }, 93, 'APPROVED'],
    ['a car added to a house does not downgrade it',
      { collaterals: [{ type: 'REAL_ESTATE', owners: [] }, { type: 'AUTO', owners: [] }] }, 95, 'APPROVED'],
    ['no collateral at all loses both pledge factors', { collaterals: [] }, 88, 'APPROVED'],
    // The sheet's problem-loans branch is unreachable, so the headline verdict ignores it; the
    // report's own «Муаммоли кредитлар» row is where the overdue loan shows.
    ['an overdue loan does not change the verdict, as in the sheet', {
      creditHistory: { ...strong().creditHistory, activeLoansCount: 1, overdueSubstandardFlag: 1 },
    }, 90, 'APPROVED'],
    ['the two −5 penalties bite', {
      creditHistory: { ...strong().creditHistory, loansOver5MFlag: 'Мавжуд', priorMfiPawnshopFlag: 'Мавжуд' },
    }, 85, 'APPROVED'],
    ['no income loses the 22-point ratio', { affordability: { newLoanPayment: 5_000_000 } }, 52, 'BELOW_MIN'],
    ['a tranche bigger than income loses it too',
      { affordability: { mainActivityIncome: 5_000_000, newLoanPayment: 9_000_000 } }, 68, 'REFER_COMMITTEE'],
    ['over 68 goes to the committee whatever it scored',
      { borrower: { ...strong().borrower, birthDate: yearsAgo(70) } }, 91, 'REFER_COMMITTEE'],
    // Not zero any more, and deliberately so: the eight questions the form stopped asking fall back
    // to the workbook's own empty-cell grades, and that floor now sits under every application.
    // Still nowhere near the 60 that would let one through.
    ['an untouched application scores only the floor the dropped questions leave',
      { borrower: {}, employment: {}, affordability: {}, creditHistory: {}, collaterals: [] }, 6, 'BELOW_MIN'],
  ];

  /*
    The point of the defaults, stated as a number.

    Eight factors are fed by questions the form no longer asks. Left null they scored zero — not
    «unknown» but «worst» — and this same applicant fell from APPROVED to REFER_COMMITTEE without
    anything about them changing. The gap between the two totals below is what the fallbacks buy
    back; if someone removes them, this test says by how much.
  */
  it('a case missing the questions the form dropped is not scored as the worst case', () => {
    const s = strong();
    const withoutDroppedQuestions = {
      borrower: {
        ...s.borrower,
        regTenure: undefined, ownsHome: undefined, depositsBand: undefined,
      },
      employment: {}, // sector, position and experience are no longer asked
      creditHistory: { activeLoansCount: 0 }, // only the three fields still on screen
    };
    const r = withCase(withoutDroppedQuestions);
    expect(r.total).toBe(75);
    expect(r.verdict).toBe('APPROVED');
  });

  it.each(cases)('%s → %i, %s', (_name, over, total, verdict) => {
    const r = withCase(over);
    expect({ total: r.total, verdict: r.verdict }).toEqual({ total, verdict });
  });

  it.each(cases)('%s holds every invariant', (_name, over) => {
    const r = withCase(over);
    expect(r.factors).toHaveLength(20);
    expect(r.factors.reduce((s, f) => s + f.points, 0)).toBe(r.total);
    expect(r.total).toBeLessThanOrEqual(r.max);
    expect(Number.isFinite(r.total)).toBe(true);
    expect(SCORE_VERDICT_LABEL[r.verdict]).toBeTruthy();
    // A factor never pays more than its ceiling, and only the two penalties may go negative.
    for (const f of r.factors) {
      expect(f.points).toBeLessThanOrEqual(f.max);
      if (f.max > 0) expect(f.points).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the age gate («Ёшга мувофиқлиги», live in the sheet\'s B24)', () => {
  it('sends an out-of-range applicant to the committee even on a passing score', () => {
    expect(verdictFor(95, 0, AGE_MAX + 1)).toBe('REFER_COMMITTEE');
    expect(verdictFor(95, 0, AGE_MIN - 1)).toBe('REFER_COMMITTEE');
  });
  it('leaves an in-range applicant alone', () => {
    expect(verdictFor(95, 0, AGE_MAX)).toBe('APPROVED');
    expect(verdictFor(95, 0, AGE_MIN)).toBe('APPROVED');
  });
  it('does not rescue a score below the minimum', () => {
    expect(verdictFor(50, 0, 40)).toBe('BELOW_MIN');
  });
  it('is skipped when the birth date is unknown', () => {
    expect(verdictFor(95, 0, null)).toBe('APPROVED');
  });
});
