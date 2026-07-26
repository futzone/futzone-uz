import { Injectable } from '@nestjs/common';
import {
  NotificationPayloadSchemas,
  NotificationTypeSchema,
  type Notification as NotificationResponse,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationPayloadMap,
  type NotificationPreference,
  type NotificationType,
  type PushSubscriptionBody,
  type UpdateNotificationPreferenceBody,
} from '@futzone/contracts';
import { v7 as uuidv7 } from 'uuid';
import type { Notification, Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueueService } from './notification-queue.service';

export interface NotifyOptions {
  matchId?: string | null;
  // Pass the caller's transaction client so the in-app row commits atomically with the mutation
  // that triggered it (several call sites are mid-`$transaction`).
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class NotificationsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly queue: NotificationQueueService,
  ) {}

  // The single entry point every module uses. Writes the durable in-app row (always on), then
  // enqueues channel fan-out (push in P5-03). Payload is validated per type at this boundary so the
  // String `type` column can never diverge from the 15-value contract.
  public async notify<T extends NotificationType>(
    userId: string,
    type: T,
    payload: NotificationPayloadMap[T],
    opts: NotifyOptions = {},
  ): Promise<void> {
    const id = await this.write(userId, type, payload, opts);
    await this.queue.enqueueDelivery({ notificationId: id, userId });
  }

  // Fan one event out to many recipients (e.g. a schedule change to every confirmed player).
  public async notifyMany<T extends NotificationType>(
    userIds: readonly string[],
    type: T,
    payload: NotificationPayloadMap[T],
    opts: NotifyOptions = {},
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    await Promise.all(unique.map((userId) => this.notify(userId, type, payload, opts)));
  }

  // Cursor pagination by descending (createdAt, id): `cursor` is the last id of the previous page.
  public async list(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const cursorRow = query.cursor
      ? await this.prisma.notification.findFirst({ where: { id: query.cursor, userId }, select: { createdAt: true, id: true } })
      : null;
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(cursorRow
          ? { OR: [{ createdAt: { lt: cursorRow.createdAt } }, { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } }] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const nextCursor = rows.length > query.limit ? (items.at(-1)?.id ?? null) : null;
    return { items: items.map((row) => this.toResponse(row)), unreadCount: await this.unreadCount(userId), nextCursor };
  }

  public async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  // Marks one notification read for its owner (no-op if already read or not theirs).
  public async markRead(userId: string, id: string): Promise<number> {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    return this.unreadCount(userId);
  }

  public async markAllRead(userId: string): Promise<number> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return this.unreadCount(userId);
  }

  // --- Preferences (P5-03): in-app always on; push opt-out stored per type ---
  public async getPreference(userId: string): Promise<NotificationPreference> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId }, select: { perTypeChannelFlags: true } });
    return { perTypeChannelFlags: (row?.perTypeChannelFlags ?? {}) as NotificationPreference['perTypeChannelFlags'] };
  }

  public async updatePreference(userId: string, body: UpdateNotificationPreferenceBody): Promise<NotificationPreference> {
    const flags = body.perTypeChannelFlags as Prisma.InputJsonValue;
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, perTypeChannelFlags: flags },
      update: { perTypeChannelFlags: flags },
      select: { perTypeChannelFlags: true },
    });
    return { perTypeChannelFlags: row.perTypeChannelFlags as NotificationPreference['perTypeChannelFlags'] };
  }

  // --- Push subscriptions (P5-03) ---
  public async savePushSubscription(userId: string, body: PushSubscriptionBody): Promise<void> {
    const keys = body.keys as Prisma.InputJsonValue;
    // Endpoint is globally unique; re-subscribing (same device) reassigns it to this user and refreshes keys.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: { id: uuidv7(), userId, endpoint: body.endpoint, keys, userAgent: body.userAgent ?? null },
      update: { userId, keys, userAgent: body.userAgent ?? null },
    });
  }

  public async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  public toResponse(row: Notification): NotificationResponse {
    return {
      id: row.id,
      type: NotificationTypeSchema.parse(row.type),
      matchId: row.matchId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async write<T extends NotificationType>(
    userId: string,
    type: T,
    payload: NotificationPayloadMap[T],
    opts: NotifyOptions,
  ): Promise<string> {
    NotificationTypeSchema.parse(type);
    const parsed = NotificationPayloadSchemas[type].parse(payload) as Prisma.InputJsonValue;
    const id = uuidv7();
    const client = opts.tx ?? this.prisma;
    await client.notification.create({
      data: { id, userId, matchId: opts.matchId ?? null, type, payload: parsed },
    });
    return id;
  }
}
