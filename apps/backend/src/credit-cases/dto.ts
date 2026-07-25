import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LoanProduct, ProductType, SellerKind, WorkflowDecision } from '@credit-core/shared';

/**
 * Empty string → null, before validation runs.
 *
 * A cleared numeric input posts `""`, not null. `@IsOptional()` only skips null and undefined, so
 * the blank field failed as «raqam bo'lishi kerak» — an error about a field the operator had
 * deliberately emptied. Applied to every optional number, integer and boolean below.
 */
const BlankToNull = () => Transform(({ value }) => (value === '' ? null : value));

export class BorrowerInput {
  @IsString() @MinLength(1) fullName!: string;
  @IsOptional() @IsString() passportSeries?: string | null;
  @IsOptional() @IsString() passportNumber?: string | null;
  @IsOptional() @IsString() pinfl?: string | null;
  @IsOptional() @IsString() birthDate?: string | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsIn(['MALE', 'FEMALE']) gender?: 'MALE' | 'FEMALE' | null;
  @IsOptional() @IsString() citizenship?: string | null;
  @IsOptional() @IsString() placeOfBirth?: string | null;
  @IsOptional() @IsString() previousName?: string | null;
  @IsOptional() @IsString() inn?: string | null;
  @IsOptional() @IsString() passportIssuer?: string | null;
  @IsOptional() @IsString() passportIssueDate?: string | null;
  @IsOptional() @IsString() passportExpiry?: string | null;
  @IsOptional() @IsString() regAddress?: string | null;
  @IsOptional() @IsString() regLandmark?: string | null;
  @IsOptional() @IsString() regTenure?: string | null;
  @IsOptional() @BlankToNull() @IsBoolean() regMatchesActual?: boolean | null;
  @IsOptional() @IsString() actualAddress?: string | null;
  @IsOptional() @IsString() actualLandmark?: string | null;
  @IsOptional() @IsString() actualTenure?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) phones?: string[] | null;
  @IsOptional() @IsString() maritalStatus?: string | null;
  @IsOptional() @BlankToNull() @IsInt() familySize?: number | null;
  @IsOptional() @BlankToNull() @IsInt() childrenCount?: number | null;
  @IsOptional() @IsString() education?: string | null;
  @IsOptional() @IsString() residenceDuration?: string | null;
  @IsOptional() @IsString() ownsHome?: string | null;
  @IsOptional() @IsString() depositsBand?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CloseContactInput) closeContacts?: CloseContactInput[] | null;
  @IsOptional() @IsString() entrepreneurType?: string | null;
  @IsOptional() @IsString() entrepreneurCertNo?: string | null;
}

export class CloseContactInput {
  @IsOptional() @IsString() relation?: string | null;
  @IsOptional() @IsString() fullName?: string | null;
  @IsOptional() @IsString() phone?: string | null;
}

export class GuarantorInput {
  @IsString() @MinLength(1) fullName!: string;
  @IsOptional() @IsString() passportSeries?: string | null;
  @IsOptional() @IsString() passportNumber?: string | null;
  @IsOptional() @IsString() pinfl?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() relation?: string | null;
}

export class CollateralOwnerInput {
  @IsString() @MinLength(1) fullName!: string;
  @IsOptional() @IsString() passportSeries?: string | null;
  @IsOptional() @IsString() passportNumber?: string | null;
  @IsOptional() @IsString() pinfl?: string | null;
  @IsOptional() @BlankToNull() @IsNumber() sharePercent?: number | null;
}

export class CollateralInput {
  @IsEnum(ProductType) type!: ProductType;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) agreedValue?: number | null;
  @IsOptional() @IsString() agreedValueWords?: string | null;

  // real estate
  @IsOptional() @IsIn(['HOUSE', 'APARTMENT']) realtyKind?: 'HOUSE' | 'APARTMENT' | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() registryNo?: string | null;
  @IsOptional() @IsString() propertyType?: string | null;
  @IsOptional() @IsString() cadastreNo?: string | null;
  @IsOptional() @IsString() registrationDate?: string | null;
  @IsOptional() @BlankToNull() @IsNumber() landAreaM2?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() totalAreaM2?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() usableAreaM2?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() livingAreaM2?: number | null;
  @IsOptional() @IsString() roomNames?: string | null;
  @IsOptional() @BlankToNull() @IsInt() roomCount?: number | null;

  // auto
  @IsOptional() @IsString() techPassportNo?: string | null;
  @IsOptional() @IsString() techPassportDate?: string | null;
  @IsOptional() @IsString() model?: string | null;
  @IsOptional() @IsString() stateNumber?: string | null;
  @IsOptional() @IsString() bodyType?: string | null;
  @IsOptional() @IsString() bodyNo?: string | null;
  @IsOptional() @IsString() engineNo?: string | null;
  @IsOptional() @IsString() chassis?: string | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @BlankToNull() @IsInt() year?: number | null;
  @IsOptional() @BlankToNull() @IsInt() mileage?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollateralOwnerInput)
  owners?: CollateralOwnerInput[];
}

export class EmploymentInput {
  @IsOptional() @IsString() employer?: string | null;
  @IsOptional() @IsString() employerAddress?: string | null;
  @IsOptional() @IsString() sector?: string | null;
  @IsOptional() @BlankToNull() @IsInt() sectorRiskCode?: number | null;
  @IsOptional() @IsString() position?: string | null;
  @IsOptional() @IsString() employedSince?: string | null;
  @IsOptional() @IsString() experienceBand?: string | null;
}

export class AffordabilityInput {
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) mainActivityIncome?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) secondaryIncome?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) familyIncome?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) otherIncome?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) utilitiesExpense?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) familyExpense?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) otherExpense?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) existingCreditBurden?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) newLoanPayment?: number | null;
}

export class InsuranceInput {
  @IsOptional() @BlankToNull() @IsBoolean() insured?: boolean;
  @IsOptional() @IsString() company?: string | null;
  @IsOptional() @IsString() genAgreementNo?: string | null;
  @IsOptional() @IsString() genAgreementDate?: string | null;
  @IsOptional() @IsString() policyNo?: string | null;
  @IsOptional() @IsString() policyIssueDate?: string | null;
  @IsOptional() @BlankToNull() @IsInt() @Min(0) @Max(600) policyTermMonths?: number | null;
  @IsOptional() @IsString() policyExpiry?: string | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) loanUnderPolicy?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) insuredSum?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) @Max(5) insuranceRate?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) premium?: number | null;
}

export class TrancheInput {
  @IsOptional() @BlankToNull() @IsInt() trancheNo?: number | null;
  @IsOptional() @IsString() applicationNo?: string | null;
  @IsOptional() @IsString() applicationDate?: string | null;
  @IsOptional() @IsString() contractNo?: string | null;
  @IsOptional() @IsString() contractDate?: string | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) principal?: number | null;
  @IsOptional() @BlankToNull() @IsInt() @Min(1) @Max(600) termMonths?: number | null;
  @IsOptional() @IsString() maturity?: string | null;
  @IsOptional() @IsIn(['ANNUITY', 'DIFFERENTIATED']) scheduleType?: 'ANNUITY' | 'DIFFERENTIATED' | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) monthlyPayment?: number | null;
  @IsOptional() @BlankToNull() @IsInt() @Min(1) @Max(31) paymentDay?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) insurancePayment?: number | null;
}

export class CreditLineInput {
  @IsOptional() @IsString() lineNumber?: string | null;
  @IsOptional() @IsIn(['MICROLOAN', 'MICROCREDIT']) loanType?: 'MICROLOAN' | 'MICROCREDIT' | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) amountAuto?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) amountPolis?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) amountTotal?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) requiredCollateralAmount?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) requiredInsuredAmount?: number | null;
  @IsOptional() @BlankToNull() @IsInt() @Min(1) @Max(600) termMonths?: number | null;
  @IsOptional() @IsString() lineDate?: string | null;
  @IsOptional() @IsString() lineMaturity?: string | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) @Max(5) interestRate?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) @Max(5) penaltyRate?: number | null;
  @IsOptional() @IsString() orderNumber?: string | null;
  @IsOptional() @ValidateNested() @Type(() => InsuranceInput) insurance?: InsuranceInput | null;
  @IsOptional() @ValidateNested() @Type(() => TrancheInput) tranche?: TrancheInput | null;
}

export class CreditHistoryInput {
  @IsOptional() @BlankToNull() @IsInt() repaidLoansCount?: number | null;
  @IsOptional() @BlankToNull() @IsInt() activeLoansCount?: number | null;
  @IsOptional() @BlankToNull() @IsInt() overdueSubstandardFlag?: number | null;
  @IsOptional() @BlankToNull() @IsInt() otherObligations?: number | null;
  @IsOptional() @IsString() loansOver5MFlag?: string | null;
  @IsOptional() @IsString() priorMfiPawnshopFlag?: string | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) totalOutstandingDebt?: number | null;
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) avgMonthlyPaymentExisting?: number | null;
  @IsOptional() @IsString() committeeProtocolRef?: string | null;
  @IsOptional() @IsString() committeeDecisionDate?: string | null;
}

export class UpsertCaseDto {
  @IsOptional() @BlankToNull() @IsNumber() @Min(0) amount?: number | null;
  @IsOptional() @BlankToNull() @IsInt() @Min(1) @Max(600) termMonths?: number | null;
  @IsOptional() @IsEnum(LoanProduct) product?: LoanProduct | null;
  @IsOptional() @IsString() sellerId?: string | null;
  @IsOptional() @IsEnum(SellerKind) sellerKind?: SellerKind | null;

  @ValidateNested()
  @Type(() => BorrowerInput)
  borrower!: BorrowerInput;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuarantorInput)
  guarantors?: GuarantorInput[];

  // Optional AND allowed to be empty during drafting: per-step autosave omits sections it isn't
  // saving, and creating from step 1 sends collaterals: []. @IsOptional only skips null/undefined,
  // so an empty array must pass @IsArray/@ValidateNested cleanly — do NOT add @ArrayMinSize here.
  // The ≥1-collateral requirement is enforced at the submit transition (caseSubmitErrors) instead.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollateralInput)
  collaterals?: CollateralInput[];

  @IsOptional() @ValidateNested() @Type(() => EmploymentInput) employment?: EmploymentInput | null;
  @IsOptional() @ValidateNested() @Type(() => AffordabilityInput) affordability?: AffordabilityInput | null;
  @IsOptional() @ValidateNested() @Type(() => CreditLineInput) creditLine?: CreditLineInput | null;
  @IsOptional() @ValidateNested() @Type(() => CreditHistoryInput) creditHistory?: CreditHistoryInput | null;
}

export class TransitionDto {
  @IsEnum(WorkflowDecision) decision!: WorkflowDecision;
  @IsOptional() @IsString() comment?: string;
}

export class SetKatmPriceDto {
  @IsNumber() @Min(0) katmPrice!: number;
}

export class SetRateDto {
  @IsNumber() @Min(0) interestRate!: number;
  @IsString() @MinLength(1) reason!: string;
}

export class ReMflSearchDto {
  @IsString() @MinLength(2) term!: string;
}

export class ReMflCreateDto {
  @IsString() @MinLength(1) sourceCaseId!: string;
}

export class DeleteCaseDto {
  @IsString() @MinLength(1) reason!: string;
}

/** Director sets the loan split: property-backed (avto) vs insurance-backed (polis) portions. */
export class SetSplitDto {
  @IsNumber() @Min(0) amountAuto!: number;
  @IsNumber() @Min(0) amountPolis!: number;
  @IsOptional() @IsString() reason?: string;
}

/** Beneficiary bank requisites for the disbursement application (may be a third party's account). */
export class DisbursementInput {
  @IsOptional() @IsString() holderName?: string | null;
  @IsOptional() @IsString() cardNumber?: string | null;
  @IsOptional() @IsString() accountNumber?: string | null;
  @IsOptional() @IsString() bankMfo?: string | null;
  @IsOptional() @IsString() holderInn?: string | null;
  @IsOptional() @IsString() bankName?: string | null;
}

export class CaseSectionDto {
  @IsIn(['borrower', 'employment', 'affordability', 'creditLine', 'creditHistory'])
  section!: 'borrower' | 'employment' | 'affordability' | 'creditLine' | 'creditHistory';

  @ValidateNested() @Type(() => UpsertCaseDto) data!: UpsertCaseDto;
}
