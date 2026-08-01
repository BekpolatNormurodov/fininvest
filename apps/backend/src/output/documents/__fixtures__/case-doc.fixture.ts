import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { withResolvedOwners, type CaseDocData } from '../case-document.loader';

/** Recursive "every field optional, nested objects too" helper for building fixture overrides. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/**
 * Deep-merge `overrides` onto `base`. Arrays and primitives in `overrides` fully replace the base
 * value. Deliberately untyped internally (Prisma's `Decimal` fields make a fully-generic `DeepPartial`
 * merge unwieldy to typecheck) — the public `mockCaseDoc` signature is what keeps callers honest.
 */
function deepMerge(base: unknown, overrides: unknown): unknown {
  if (overrides === undefined) return base;
  if (Array.isArray(overrides)) return overrides;
  if (isPlainObject(base) && isPlainObject(overrides)) {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(overrides)) {
      out[key] = deepMerge(base[key], overrides[key]);
    }
    return out;
  }
  return overrides;
}

/**
 * A realistic, structurally-complete loaded case for exercising document templates in tests.
 * Pass `overrides` to flip a single field (e.g. `{ scoring: { verdict: 'FAILED_INCOME' } }`)
 * without having to reconstruct the whole object.
 */
export function mockCaseDoc(overrides?: DeepPartial<CaseDocData>): CaseDocData {
  const base = {
    id: 'case-1',
    number: 'A-000123',
    productType: 'AUTO',
    status: 'DIRECTOR_REVIEW',
    amount: 150_000_000,
    termMonths: 24,
    katmPrice: null,
    contractNumber: '2012 MFL 1320 PS',
    /*
      The three columns the contract number is built from. They were missing here, so any template
      reading them rendered `undefined` under every spec while working in production. The бош
      келишув number is one of those, which is how a dossier printing one number under two labels
      stayed green. Kept consistent with contractNumber above: 2012 MFL 1320 PS.
    */
    contractGlobalNo: 2012,
    contractYearlyNo: 1320,
    contractBranchSym: 'PS',
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    updatedAt: new Date('2026-01-10T00:00:00.000Z'),

    branch: {
      id: 'branch-1',
      name: 'Марказий филиал',
      symbol: 'PS',
      region: 'Toshkent',
    },

    borrower: {
      id: 'borrower-1',
      caseId: 'case-1',
      fullName: 'ЖЎЛДИБАЕВ РУСЛАН',
      passportSeries: 'AD',
      passportNumber: '1234567',
      pinfl: '52101901234567',
      birthDate: new Date('1990-05-12T00:00:00.000Z'),
      address: 'Тошкент ш., Чилонзор тумани',
      phone: '+998901234567',
      gender: 'MALE',
      citizenship: "O'zbekiston",
      regAddress: 'Тошкент ш., Чилонзор тумани, 12-уй',
      entrepreneurType: 'Якка тартибдаги тадбиркор',
      entrepreneurCertNo: '00114455',
      inn: '301456789',
    },

    collaterals: [
      {
        id: 'collateral-1',
        caseId: 'case-1',
        type: 'REAL_ESTATE',
        agreedValue: 200_000_000,
        agreedValueWords: null,
        realtyKind: 'HOUSE',
        propertyType: 'YAKKA TARTIBDAGI TURAR JOY',
        address: 'Тошкент ш., Юнусобод тумани, 5-уй',
        registryNo: 'REG-0001',
        cadastreNo: 'CAD-0001',
        totalAreaM2: 120,
        livingAreaM2: 90,
        usableAreaM2: 105,
        landAreaM2: 400,
        roomCount: 4,
        roomNames: 'зал, ошхона, 2 та ётоқхона',
        owners: [
          {
            id: 'owner-1',
            collateralId: 'collateral-1',
            fullName: 'ЖЎЛДИБАЕВ РУСЛАН',
            passportSeries: 'AD',
            passportNumber: '1234567',
            sharePercent: 100,
            isBorrowerOwner: true,
          },
        ],
      },
      {
        id: 'collateral-2',
        caseId: 'case-1',
        type: 'AUTO',
        agreedValue: 180_000_000,
        agreedValueWords: null,
        model: 'Chevrolet Cobalt',
        techPassportNo: 'TP-998877',
        techPassportDate: new Date('2023-03-01T00:00:00.000Z'),
        stateNumber: '01 A 123 BC',
        color: 'Оқ',
        year: 2022,
        owners: [
          {
            id: 'owner-2',
            collateralId: 'collateral-2',
            fullName: 'ЖЎЛДИБАЕВ РУСЛАН',
            passportSeries: 'AD',
            passportNumber: '1234567',
            sharePercent: 100,
            isBorrowerOwner: true,
          },
        ],
      },
    ],

    creditLine: {
      id: 'line-1',
      caseId: 'case-1',
      lineNumber: 'РКЛ-0042',
      loanType: 'MICROCREDIT',
      amountAuto: 150_000_000,
      amountPolis: 10_000_000,
      amountTotal: 150_000_000,
      requiredCollateralAmount: null,
      requiredInsuredAmount: null,
      termMonths: 24,
      lineDate: new Date('2026-01-05T00:00:00.000Z'),
      lineMaturity: new Date('2028-01-05T00:00:00.000Z'),
      interestRate: 0.55,
      penaltyRate: 1.05,
      orderNumber: 'ORD-0042',
      tranches: [
        {
          id: 'tranche-1',
          creditLineId: 'line-1',
          trancheNo: 1,
          applicationNo: 'APP-0001',
          applicationDate: new Date('2026-01-06T00:00:00.000Z'),
          contractNo: 'CN-0001',
          contractDate: new Date('2026-01-06T00:00:00.000Z'),
          principal: 150_000_000,
          termMonths: 24,
          maturity: new Date('2028-01-06T00:00:00.000Z'),
          scheduleType: 'ANNUITY',
          monthlyPayment: 7_500_000,
          paymentDay: 6,
          insurancePayment: 300_000,
          schedule: {
            id: 'schedule-1',
            trancheId: 'tranche-1',
            method: 'ANNUITY',
            principal: 150_000_000,
            termMonths: 24,
            annualRate: 0.55,
            disbursementDate: new Date('2026-01-06T00:00:00.000Z'),
            paymentDayCap: 25,
            generatedAt: new Date('2026-01-06T00:00:00.000Z'),
            installments: [
              {
                id: 'installment-1',
                scheduleId: 'schedule-1',
                seq: 1,
                dueDate: new Date('2026-02-06T00:00:00.000Z'),
                openingBalance: 150_000_000,
                principal: 5_375_000,
                interest: 6_875_000,
                total: 12_250_000,
                days: 31,
              },
              {
                id: 'installment-2',
                scheduleId: 'schedule-1',
                seq: 2,
                dueDate: new Date('2026-03-06T00:00:00.000Z'),
                openingBalance: 144_625_000,
                principal: 5_620_313,
                interest: 6_629_688,
                total: 12_250_000,
                days: 28,
              },
              {
                id: 'installment-3',
                scheduleId: 'schedule-1',
                seq: 3,
                dueDate: new Date('2026-04-06T00:00:00.000Z'),
                openingBalance: 139_004_688,
                principal: 5_877_734,
                interest: 6_372_266,
                total: 12_250_000,
                days: 31,
              },
            ],
          },
        },
      ],
      insurance: {
        id: 'insurance-1',
        creditLineId: 'line-1',
        insured: true,
        company: '"Kafolat" sugʻurta',
        genAgreementNo: 'GA-0001',
        genAgreementDate: new Date('2026-01-05T00:00:00.000Z'),
        policyNo: 'POL-0001',
        policyIssueDate: new Date('2026-01-06T00:00:00.000Z'),
        policyTermMonths: 24,
        policyExpiry: new Date('2028-01-06T00:00:00.000Z'),
        loanUnderPolicy: 150_000_000,
        insuredSum: 10_000_000,
        insuranceRate: 0.02,
        premium: 3_000_000,
      },
    },

    employment: {
      id: 'employment-1',
      caseId: 'case-1',
      employer: 'YAKKA TARTIBDAGI TADBIRKOR',
      employerAddress: null,
      sector: null,
      sectorRiskCode: null,
      position: 'Раҳбарият',
      employedSince: null,
      experienceBand: null,
    },

    affordability: {
      id: 'afford-1',
      caseId: 'case-1',
      avgMonthlyIncome: 12_000_000,
      mainActivityIncome: 10_000_000,
      secondaryIncome: 2_000_000,
      familyIncome: 0,
      otherIncome: 0,
      newLoanPayment: 7_500_000,
      utilitiesExpense: 800_000,
      familyExpense: 1_500_000,
      existingCreditBurden: 0,
      otherExpense: 200_000,
      totalIncome: 12_000_000,
      totalCreditPayments: 7_500_000,
      totalExpenses: 2_500_000,
      dtiRatio: 0.625,
      surplus: 2_000_000,
      netAfterDebt: 2_000_000,
      computedAt: new Date('2026-01-08T00:00:00.000Z'),
    },

    creditHistory: {
      id: 'history-1',
      caseId: 'case-1',
      repaidLoansCount: 3,
      activeLoansCount: 1,
      overdueSubstandardFlag: 0,
      otherObligations: 0,
      loansOver5MFlag: "Yo'q",
      priorMfiPawnshopFlag: "Yo'q",
      totalOutstandingDebt: 5_000_000,
      avgMonthlyPaymentExisting: 500_000,
      committeeProtocolRef: null,
      committeeDecisionDate: null,
    },

    scoring: {
      id: 'scoring-1',
      caseId: 'case-1',
      totalScore: 82,
      maxScore: 100,
      verdict: 'APPROVED',
      age: 36,
      monthlyTranches: 7_500_000,
      monthlyIncome: 12_000_000,
      monthlyExpenses: 2_500_000,
      surplus: 2_000_000,
      netAfterDebt: 2_000_000,
      computedAt: new Date('2026-01-09T00:00:00.000Z'),
      factors: [
        { id: 'factor-1', resultId: 'scoring-1', factorNo: 1, name: 'Ёши', points: 8, maxPoints: 10 },
        { id: 'factor-2', resultId: 'scoring-1', factorNo: 2, name: 'Даромад барқарорлиги', points: 18, maxPoints: 20 },
        { id: 'factor-3', resultId: 'scoring-1', factorNo: 3, name: 'Кредит тарихи', points: 15, maxPoints: 15 },
      ],
    },

    incomeCertificate: null,

    disbursement: {
      id: 'disbursement-1',
      caseId: 'case-1',
      holderName: 'ЖЎЛДИБАЕВ РУСЛАН',
      cardNumber: '5614681810235717',
      accountNumber: '23120000800011438001',
      bankMfo: '00083',
      holderInn: '200242936',
      bankName: '"Xalq banki" ATB',
      updatedAt: new Date('2026-01-10T00:00:00.000Z'),
    },

    documents: [
      {
        id: 'doc-1',
        caseId: 'case-1',
        collateralId: null,
        title: 'КАТМ ҳисоботи',
        description: null,
        type: 'OTHER',
        fileName: 'katm-report.pdf',
        storagePath: '/files/katm-report.pdf',
        mimeType: 'application/pdf',
        isGenerated: false,
        uploadedById: 'user-1',
        messageId: null,
        createdAt: new Date('2026-01-07T00:00:00.000Z'),
      },
      {
        id: 'doc-2',
        caseId: 'case-1',
        collateralId: null,
        title: 'Гаров шартномаси (нотариал тасдиқ)',
        description: null,
        type: 'NOTARY',
        fileName: 'notary-pledge.pdf',
        storagePath: '/files/notary-pledge.pdf',
        mimeType: 'application/pdf',
        isGenerated: false,
        uploadedById: 'user-1',
        messageId: null,
        createdAt: new Date('2026-01-07T00:00:00.000Z'),
      },
    ],

    // The lender, exactly as the seed writes it — from «Д0» of «АВТО мфл APEX (2).xlsx». A fixture
    // carrying a different organisation than production would let a document that prints the wrong
    // firm pass its own tests.
    organization: {
      id: 'default',
      tradeMark: 'FINCOM INVEST',
      nameMixed: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
      nameUpper: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
      nameSuffix: '«FINCOM INVEST» MIKROMOLIYA TASHKILOTI МЧЖ',
      directorShort: 'Таджибаев А.Ю',
      directorFull: 'Таджибаев А.Ю',
      legalBasis: 'Низом',
      address: 'Тошкент шахар, Чилонзор тумани, Катта Чилонзор-3 МФЙ Чилонзор кучаси 82в-уй',
      bankAccount: '2021 6000 8073 0412 2001',
      bankMfo: '01196',
      bankName: '«APEX BANK» АЖ',
      phone: '90-000-79-25',
      phone2: '70-224-00-60',
      inn: '312 356 239',
      licenseNo: '61',
      licenseDate: new Date('2019-06-22T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };

  // Through the same implied-owner rule the loader applies, so a test that leaves  empty
  // sees exactly what production renders — the borrower standing in — rather than «—».
  return withResolvedOwners(deepMerge(base, overrides) as unknown as CaseDocData);
}

/**
 * Recursively walk a pdfmake document definition's `content` tree and collect every string
 * (from `.text`, table `.body` cells, `.stack`, `.columns`, and plain arrays) into one
 * space-joined string, so tests can assert `.toContain(...)` / `.not.toContain(...)`.
 */
export function flattenDocText(def: TDocumentDefinitions): string {
  const out: string[] = [];

  /**
   * Render an inline `text` value the way pdfmake does: an array of runs is CONCATENATED with no
   * separator (that is how rich text like `['Фуқаро ', {text: name, bold: true}, ' билан']` prints).
   * Joining those with a space would fabricate gaps the PDF never shows.
   */
  function inlineText(node: unknown): string {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'number' || typeof node === 'boolean') return String(node);
    if (Array.isArray(node)) return node.map(inlineText).join('');
    if (typeof node === 'object') {
      const n = node as Record<string, unknown>;
      if (n.text !== undefined) return inlineText(n.text);
    }
    return '';
  }

  function walk(node: unknown): void {
    if (node == null) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (typeof node === 'number' || typeof node === 'boolean') {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object') return;

    const n = node as Record<string, unknown>;

    if (n.text !== undefined) out.push(inlineText(n.text));
    if (n.stack !== undefined) walk(n.stack);
    if (n.columns !== undefined) walk(n.columns);
    if (n.ul !== undefined) walk(n.ul);
    if (n.ol !== undefined) walk(n.ol);
    if (n.table !== undefined && isPlainObject(n.table) && (n.table as Record<string, unknown>).body !== undefined) {
      walk((n.table as Record<string, unknown>).body);
    }
  }

  walk((def as unknown as { content: Content }).content);
  return out.join(' ');
}
