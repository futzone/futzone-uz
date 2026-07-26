import { Injectable } from '@nestjs/common';
import type { DeliverNotificationJobPayload, NotificationType } from '@futzone/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { isPushEnabled } from './notification-preferences';
import { NotificationsService } from './notifications.service';
import { NotificationStreamService } from './notification-stream.service';
import { WebPushService } from './web-push.service';

@Injectable()
export class NotificationDeliveryService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStreamService,
    private readonly webPush: WebPushService,
  ) {}

  // Idempotent: the durable in-app row is already persisted by notify(); this job fans out to the
  // live SSE stream and push, both safe to re-run. Re-processing writes no state.
  public async deliver(payload: DeliverNotificationJobPayload): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id: payload.notificationId } });
    if (!notification) {
      // The enqueue can beat the caller's transaction commit; throw so BullMQ retries with backoff
      // until the row becomes visible. Reaching this branch guarantees the row is committed.
      throw new Error(`Notification ${payload.notificationId} not visible yet`);
    }
    const unreadCount = await this.notifications.unreadCount(notification.userId);
    await this.stream.publish(notification.userId, { notification: this.notifications.toResponse(notification), unreadCount });
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId: notification.userId },
      select: { perTypeChannelFlags: true },
    });
    if (!isPushEnabled(preference?.perTypeChannelFlags ?? null, notification.type as NotificationType)) return;
    await this.webPush.send({ notificationId: notification.id, userId: notification.userId, type: notification.type });
  }
}
