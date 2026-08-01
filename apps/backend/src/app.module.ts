import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

// The backend can run as several replicas behind nginx. @Cron jobs (SLA deadlines, audit retention)
// must fire in exactly ONE instance — otherwise every replica runs them, duplicating notifications
// and writes. Only the instance with RUN_SCHEDULER=1 (the dedicated `scheduler` service) loads the
// scheduler; without it the @Cron handlers are inert metadata, so API replicas never fire them.
const SCHEDULER = process.env.RUN_SCHEDULER === '1';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { CreditCasesModule } from './credit-cases/credit-cases.module';
import { DocumentsModule } from './documents/documents.module';
import { ImportModule } from './import/import.module';
import { OutputModule } from './output/output.module';
import { KatmModule } from './katm/katm.module';
import { StatsModule } from './stats/stats.module';
import { MessagesModule } from './messages/messages.module';
import { SettingsModule } from './settings/settings.module';
import { DeadlinesModule } from './deadlines/deadlines.module';
import { AuditModule } from './audit/audit.module';
import { SigningModule } from './signing/signing.module';
import { PassportModule } from './passport/passport.module';
import { SellersModule } from './sellers/sellers.module';
import { CollectionsModule } from './collections/collections.module';
import { CollectorsModule } from './collectors/collectors.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env'), join(__dirname, '..', '..', '..', '.env')],
    }),
    ...(SCHEDULER ? [ScheduleModule.forRoot()] : []),
    PrismaModule,
    DocumentsModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    CreditCasesModule,
    SellersModule,
    ImportModule,
    OutputModule,
    KatmModule,
    StatsModule,
    MessagesModule,
    SettingsModule,
    DeadlinesModule,
    AuditModule,
    PassportModule,
    SigningModule,
    CollectionsModule,
    CollectorsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
