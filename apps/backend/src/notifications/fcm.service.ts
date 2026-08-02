import { readFileSync } from 'fs';
import { Global, Injectable, Module } from '@nestjs/common';
import { type App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sends Firebase Cloud Messaging pushes to a user's registered devices.
 *
 * Credentials come from a service-account JSON pointed to by `FIREBASE_CREDENTIALS` (or the standard
 * `GOOGLE_APPLICATION_CREDENTIALS`). Without them the service is a silent no-op — the in-app
 * notifications still work, and dropping the key file in activates push with no code change.
 */
@Injectable()
export class FcmService {
  constructor(private readonly prisma: PrismaService) {}

  private app: App | null = null;
  private tried = false;

  private ensure(): void {
    if (this.tried) return;
    this.tried = true;
    try {
      const path = process.env.FIREBASE_CREDENTIALS ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!path) return;
      const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
      this.app = getApps().length ? getApp() : initializeApp({ credential: cert(serviceAccount) });
    } catch {
      this.app = null;
    }
  }

  async sendToUsers(userIds: string[], title: string, body: string, caseId?: string | null): Promise<void> {
    this.ensure();
    if (!this.app || !userIds.length) return;
    try {
      const rows = await this.prisma.deviceToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } });
      const tokens = rows.map((r) => r.token);
      if (!tokens.length) return;
      await getMessaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: caseId ? { caseId } : {},
        android: { priority: 'high' },
      });
    } catch {
      /* push is advisory */
    }
  }
}

@Global()
@Module({ providers: [FcmService], exports: [FcmService] })
export class FcmModule {}
