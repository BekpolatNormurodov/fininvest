import { Controller, Get, Injectable, Module, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { CaseStatus, type ScheduleRow } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { loadCaseForDocs } from '../output/documents/case-document.loader';
import { scheduleForCase } from '../output/documents/schedule';

/**
 * The payment schedule (grafik) as data.
 *
 * It is computed on demand from the tranche parameters (the same function the grafik/Excel documents
 * use) and — once the case is finalized — persisted into `PaymentSchedule`/`Installment` so it is a
 * stable list reusable everywhere (the undiruv form reads it to pre-fill each unpaid month). A
 * non-finalized case still gets a live computation, just not frozen to the database.
 */
@Injectable()
class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async forCase(id: string): Promise<ScheduleRow[]> {
    const c = await loadCaseForDocs(this.prisma, id);
    if (!c) throw new NotFoundException('Ariza topilmadi');

    const sched = scheduleForCase(c);
    if (!sched) return [];

    const tranche = c.creditLine?.tranches?.[0];
    const alreadyPersisted = !!tranche?.schedule?.installments?.length;
    const finalized = c.status === CaseStatus.FINALIZED || !!c.docsFrozenAt;

    if (tranche && !alreadyPersisted && finalized) {
      try {
        await this.prisma.paymentSchedule.create({
          data: {
            trancheId: tranche.id,
            method: sched.method,
            principal: sched.principal,
            termMonths: sched.termMonths,
            annualRate: sched.annualRate,
            disbursementDate: sched.disbursementDate,
            paymentDayCap: 15,
            installments: {
              create: sched.installments.map((i) => ({
                seq: i.seq,
                dueDate: i.dueDate,
                openingBalance: i.openingBalance,
                principal: i.principal,
                interest: i.interest,
                total: i.total,
                days: i.days,
              })),
            },
          },
        });
      } catch {
        /* a concurrent request may have persisted it first — the live rows are still returned */
      }
    }

    return sched.installments.map((i) => ({
      seq: i.seq,
      dueDate: i.dueDate.toISOString(),
      year: i.dueDate.getFullYear(),
      month: i.dueDate.getMonth() + 1,
      openingBalance: i.openingBalance,
      principal: i.principal,
      interest: i.interest,
      total: i.total,
    }));
  }
}

@UseGuards(JwtAuthGuard)
@Controller('cases')
class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Get(':id/schedule')
  schedule(@Param('id') id: string): Promise<ScheduleRow[]> {
    return this.service.forCase(id);
  }
}

@Module({ controllers: [ScheduleController], providers: [ScheduleService] })
export class ScheduleModule {}
