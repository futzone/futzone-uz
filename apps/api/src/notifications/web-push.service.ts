import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Locale, NotificationType } from '@futzone/contracts';
import webpush from 'web-push';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { pushContent } from './push-content';

export interface PushDeliveryTarget {
  notificationId: string;
  userId: string;
  type: string;
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private enabled = false;

  public constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  public onModuleInit(): void {
    const publicKey = this.config.get('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get('VAPID_PRIVATE_KEY');
    if (publicKey && privateKey) {
      webpush.setVapidDetails(this.config.get('VAPID_SUBJECT'), publicKey, privateKey);
      this.enabled = true;
    } else {
      this.logger.warn('VAPID keys not configured — push delivery is disabled (in-app only)');
    }
  }

  public get publicKey(): string | null { return this.config.get('VAPID_PUBLIC_KEY') ?? null; }
  public get isEnabled(): boolean { return this.enabled; }

  // Best-effort fan-out to every registered device for the user. Endpoints that report Gone
  // (404/410) are pruned. Never throws — push must not fail the delivery job or its SSE fan-out.
  public async send(target: PushDeliveryTarget): Promise<void> {
    if (!this.enabled) return;
    const [user, subscriptions] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: target.userId }, select: { locale: true } }),
      this.prisma.pushSubscription.findMany({ where: { userId: target.userId } }),
    ]);
    if (!subscriptions.length) return;
    const { title, body } = pushContent(target.type as NotificationType, (user?.locale ?? 'uz') as Locale);
    const payload = JSON.stringify({ notificationId: target.notificationId, type: target.type, title, body, url: '/notifications' });
    await Promise.all(subscriptions.map(async (sub) => {
      const keys = sub.keys as { p256dh: string; auth: string };
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys }, payload);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          this.logger.warn(`push send failed for ${sub.endpoint}: ${String(error)}`);
        }
      }
    }));
  }
}
