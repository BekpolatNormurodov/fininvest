import { Body, Controller, Get, Post, Module, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { SellerKind } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Create/update a seller (distributor). Individual owner or a legal firm (dealer/developer). */
class UpsertSellerDto {
  @IsEnum(SellerKind) kind!: SellerKind;

  // individual
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() pinfl?: string;
  @IsOptional() @IsString() passport?: string;
  @IsOptional() @IsString() address?: string;

  // legal
  @IsOptional() @IsString() orgName?: string;
  @IsOptional() @IsString() stir?: string;
  @IsOptional() @IsString() directorName?: string;
  @IsOptional() @IsString() legalAddress?: string;

  // common
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() bankAccount?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() mfoCode?: string;
  @IsOptional() @IsString() ownershipDoc?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() isCatalog?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('sellers')
class SellersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Saved legal sellers (firms/dealers) to pick from in the wizard. */
  @Get('catalog')
  catalog() {
    return this.prisma.seller.findMany({
      where: { isCatalog: true },
      orderBy: { orgName: 'asc' },
    });
  }

  @Post()
  create(@Body() dto: UpsertSellerDto) {
    return this.prisma.seller.create({ data: dto });
  }
}

@Module({ controllers: [SellersController] })
export class SellersModule {}
