import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CollectionStatus, collectionDeadline } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from '../notifications/fcm.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Watches undiruv (collection) deadlines. For each open, assigned collection whose deadline
 * (assignment date + dueDays) is within a day, or already passed, it notifies the collector +
 * the manager ONCE each — the dueSoonNotified/overdueNotified flags guard against repeats.
 * No status change; purely «belgi + bildirishnoma», like the case-step deadline watcher.
 */
@Injectable()
export class CollectionDeadlineService {
  private readonly logger = new Logger(CollectionDeadlineService.name);

  constructor(private readonly prisma: PrismaService, private readonly fcm: FcmService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async check(): Promise<void> {
    const now = new Date();
    const active = await this.prisma.collection.findMany({
      where: {
        status: { not: CollectionStatus.CLOSED },
        assignedCollectorId: { not: null },
        OR: [{ dueSoonNotified: false }, { overdueNotified: false }],
      },
      select: {
        id: true, caseId: true, dueDays: true, assignedAt: true, createdAt: true,
        assignedCollectorId: true, assignedById: true, createdById: true,
        dueSoonNotified: true, overdueNotified: true,
        case: { select: { number: true, contractNumber: true, borrower: { select: { fullName: true } } } },
      },
    });

    let due = 0;
    let over = 0;
    for (const c of active) {
      const deadlineIso = collectionDeadline((c.assignedAt ?? c.createdAt).toISOString(), c.dueDays);
      if (!deadlineIso) continue;
      const deadline = new Date(deadlineIso).getTime();
      const who = c.case.borrower?.fullName ?? c.case.contractNumber ?? c.case.number;
      const overdue = deadline < now.getTime();
      const dueSoon = !overdue && deadline - now.getTime() <= DAY_MS;

      if (overdue && !c.overdueNotified) {
        await this.fire(c, 'COLLECTION_OVERDUE', 'Undiruv muddati o‘tdi', `${who} bo‘yicha undiruv muddati o‘tib ketdi.`);
        await this.prisma.collection.update({ where: { id: c.id }, data: { overdueNotified: true, dueSoonNotified: true } });
        over++;
      } else if (dueSoon && !c.dueSoonNotified) {
        await this.fire(c, 'COLLECTION_DUE_SOON', 'Undiruv muddati yaqin', `${who} bo‘yicha undiruv muddati tugayapti (1 kun ichida).`);
        await this.prisma.collection.update({ where: { id: c.id }, data: { dueSoonNotified: true } });
        due++;
      }
    }
    if (due || over) this.logger.log(`Undiruv muddati: ${due} yaqin, ${over} o‘tgan — bildirishnoma yuborildi`);
  }

  private async fire(
    c: { caseId: string; assignedCollectorId: string | null; assignedById: string | null; createdById: string },
    type: string,
    title: string,
    body: string,
  ): Promise<void> {
    const targets = Array.from(
      new Set([c.assignedCollectorId, c.assignedById ?? c.createdById].filter(Boolean) as string[]),
    );
    if (!targets.length) return;
    try {
      await this.prisma.notification.createMany({ data: targets.map((userId) => ({ userId, type, title, body, caseId: c.caseId })) });
    } catch {
      /* advisory — a notification failure must not break the sweep */
    }
    await this.fcm.sendToUsers(targets, title, body, c.caseId);
  }
}
