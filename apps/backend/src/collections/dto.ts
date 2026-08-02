import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CollectionStatus, LetterType } from '@credit-core/shared';

export class CollectionMonthDto {
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsInt() @Min(1) @Max(12) month!: number;
  @IsNumber() @Min(0) amount!: number;
}

export class CreateCollectionDto {
  @IsString() @MinLength(1) caseId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CollectionMonthDto)
  months!: CollectionMonthDto[];
  @IsOptional() @IsNumber() @Min(0) penalty?: number;
  @IsOptional() @IsNumber() @Min(0) fine?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() assignedCollectorId?: string;
}

export class UpdateCollectionDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CollectionMonthDto)
  months?: CollectionMonthDto[];
  @IsOptional() @IsNumber() @Min(0) penalty?: number;
  @IsOptional() @IsNumber() @Min(0) fine?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() assignedCollectorId?: string | null;
  @IsOptional() @IsEnum(CollectionStatus) status?: CollectionStatus;
}

/** A field visit, submitted as multipart (files under `media`) — fields arrive as strings, coerced. */
export class CreateVisitDto {
  @Type(() => Number) @IsNumber() @Min(0) amount!: number;
  @IsEnum(LetterType) letterType!: LetterType;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng?: number;
}
