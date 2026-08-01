import {
  matchesCaseFilter, activeFilterCount, EMPTY_CASE_FILTER,
  type CaseFilter, type CreditCaseListItem, LoanProduct,
} from '@credit-core/shared';

/*
  The applications-list filter, exercised as the pure logic the UI hands the table.

  Every dimension AND-s with the others; within a dimension the chosen values OR. An empty filter
  matches everything, which is the whole-list case.
*/
const row = (o: Partial<CreditCaseListItem>): CreditCaseListItem => ({
  id: 'c', number: 'BR-1', contractNumber: null, productType: 'AUTO' as never,
  product: LoanProduct.AVTO, status: 'MODERATION' as never, amount: 1, borrowerName: 'X',
  branchSymbol: 'BR', branchName: 'Buxoro filiali', region: 'Buxoro', insured: true,
  createdByName: null, createdAt: '2026-03-15T10:00:00.000Z', stepDeadlineAt: null,
  updatedAt: '2026-03-15T10:00:00.000Z', ...o,
});
const filter = (o: Partial<CaseFilter>): CaseFilter => ({ ...EMPTY_CASE_FILTER, ...o });

describe('the empty filter matches everything', () => {
  it('passes any row and counts as zero active dimensions', () => {
    expect(matchesCaseFilter(EMPTY_CASE_FILTER, row({}))).toBe(true);
    expect(activeFilterCount(EMPTY_CASE_FILTER)).toBe(0);
  });
});

describe('product', () => {
  it('keeps a row whose product is selected, drops the others', () => {
    const f = filter({ products: new Set([LoanProduct.AVTO, LoanProduct.IPOTEKA]) });
    expect(matchesCaseFilter(f, row({ product: LoanProduct.AVTO }))).toBe(true);
    expect(matchesCaseFilter(f, row({ product: LoanProduct.OSON }))).toBe(false);
    expect(matchesCaseFilter(f, row({ product: null }))).toBe(false);
  });
});

describe('insurance', () => {
  it('«yes» keeps only insured, «no» only uninsured', () => {
    expect(matchesCaseFilter(filter({ insured: 'yes' }), row({ insured: true }))).toBe(true);
    expect(matchesCaseFilter(filter({ insured: 'yes' }), row({ insured: false }))).toBe(false);
    expect(matchesCaseFilter(filter({ insured: 'no' }), row({ insured: false }))).toBe(true);
    expect(matchesCaseFilter(filter({ insured: 'no' }), row({ insured: true }))).toBe(false);
  });
});

describe('region and branch', () => {
  it('filters on the branch region', () => {
    const f = filter({ regions: new Set(['Buxoro']) });
    expect(matchesCaseFilter(f, row({ region: 'Buxoro' }))).toBe(true);
    expect(matchesCaseFilter(f, row({ region: 'Toshkent' }))).toBe(false);
    expect(matchesCaseFilter(f, row({ region: null }))).toBe(false);
  });

  it('filters on the branch name', () => {
    const f = filter({ branches: new Set(['Buxoro filiali']) });
    expect(matchesCaseFilter(f, row({ branchName: 'Buxoro filiali' }))).toBe(true);
    expect(matchesCaseFilter(f, row({ branchName: 'Markaziy filial' }))).toBe(false);
  });
});

describe('the date range compares by day, inclusive of both ends', () => {
  const f = filter({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T00:00:00.000Z' });

  it('keeps a row inside the range', () => {
    expect(matchesCaseFilter(f, row({ createdAt: '2026-03-15T10:00:00.000Z' }))).toBe(true);
  });

  it('includes the whole of the end day — a case created that evening still matches', () => {
    expect(matchesCaseFilter(f, row({ createdAt: '2026-03-31T23:30:00.000Z' }))).toBe(true);
  });

  it('includes the start day from its first minute', () => {
    expect(matchesCaseFilter(f, row({ createdAt: '2026-03-01T00:05:00.000Z' }))).toBe(true);
  });

  it('drops rows before the start and after the end', () => {
    expect(matchesCaseFilter(f, row({ createdAt: '2026-02-28T12:00:00.000Z' }))).toBe(false);
    expect(matchesCaseFilter(f, row({ createdAt: '2026-04-01T00:05:00.000Z' }))).toBe(false);
  });

  it('an open end filters on only the other bound', () => {
    expect(matchesCaseFilter(filter({ from: '2026-03-10T00:00:00.000Z' }), row({ createdAt: '2026-03-15T10:00:00.000Z' }))).toBe(true);
    expect(matchesCaseFilter(filter({ from: '2026-03-20T00:00:00.000Z' }), row({ createdAt: '2026-03-15T10:00:00.000Z' }))).toBe(false);
  });
});

describe('dimensions combine with AND', () => {
  it('a row must satisfy every active dimension', () => {
    const f = filter({ products: new Set([LoanProduct.AVTO]), insured: 'yes', regions: new Set(['Buxoro']) });
    expect(matchesCaseFilter(f, row({ product: LoanProduct.AVTO, insured: true, region: 'Buxoro' }))).toBe(true);
    // Right product and region, but uninsured — fails the insurance dimension.
    expect(matchesCaseFilter(f, row({ product: LoanProduct.AVTO, insured: false, region: 'Buxoro' }))).toBe(false);
  });

  it('counts each narrowing dimension once', () => {
    expect(activeFilterCount(filter({ products: new Set([LoanProduct.AVTO]), insured: 'yes' }))).toBe(2);
    expect(activeFilterCount(filter({ from: '2026-03-01T00:00:00.000Z' }))).toBe(1);   // from|to is one dimension
    expect(activeFilterCount(filter({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T00:00:00.000Z' }))).toBe(1);
  });
});
