import type { Prisma } from '../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationStreamService } from './notification-stream.service';
import { WebPushService } from './web-push.service';
import { isPushEnabled } from './notification-preferences';

describe('NotificationsService.notify', () => {
  function build(): { service: NotificationsService; create: jest.Mock; enqueue: jest.Mock } {
    const create = jest.fn(async () => undefined);
    const enqueue = jest.fn(async () => undefined);
    const prisma = { notification: { create } } as unknown as PrismaService;
    const queue = { enqueueDelivery: enqueue } as unknown as NotificationQueueService;
    return { service: new NotificationsService(prisma, queue), create, enqueue };
  }

  it('writes the in-app row and enqueues delivery for the recipient', async () => {
    const { service, create, enqueue } = build();
    await service.notify('user-1', 'JOIN_APPROVED', {}, { matchId: 'match-1' });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', type: 'JOIN_APPROVED', matchId: 'match-1' }),
    });
    const id = (create.mock.calls[0]![0] as { data: { id: string } }).data.id;
    expect(enqueue).toHaveBeenCalledWith({ notificationId: id, userId: 'user-1' });
  });

  it('writes through the caller transaction client and never touches the base client', async () => {
    const { service, create, enqueue } = build();
    const txCreate = jest.fn(async () => undefined);
    const tx = { notification: { create: txCreate } } as unknown as Prisma.TransactionClient;
    await service.notify('user-2', 'WAITLIST_PROMOTED', { expiresAt: '2035-01-01T00:00:00.000Z' }, { tx });
    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('validates the payload per type and rejects a malformed one before writing', async () => {
    const { service, create, enqueue } = build();
    await expect(
      service.notify('user-3', 'WAITLIST_PROMOTED', { expiresAt: 'not-a-date' }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('deduplicates recipients in notifyMany', async () => {
    const { service, create } = build();
    await service.notifyMany(['u1', 'u1', 'u2'], 'MATCH_UPDATED', { scheduleChanged: true, stadiumChanged: false });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('isPushEnabled', () => {
  it('defaults to enabled when there is no preference row or entry', () => {
    expect(isPushEnabled(null, 'WAITLIST_PROMOTED')).toBe(true);
    expect(isPushEnabled({}, 'WAITLIST_PROMOTED')).toBe(true);
    expect(isPushEnabled({ MATCH_UPDATED: { push: false } }, 'WAITLIST_PROMOTED')).toBe(true);
  });

  it('honours an explicit opt-out for that exact type only', () => {
    const flags = { WAITLIST_PROMOTED: { push: false } };
    expect(isPushEnabled(flags, 'WAITLIST_PROMOTED')).toBe(false);
    expect(isPushEnabled(flags, 'MATCH_UPDATED')).toBe(true);
  });
});

describe('NotificationDeliveryService', () => {
  function build(notification: unknown, preference: unknown): { service: NotificationDeliveryService; send: jest.Mock; publish: jest.Mock } {
    const send = jest.fn(async () => undefined);
    const publish = jest.fn(async () => undefined);
    const prisma = {
      notification: { findUnique: jest.fn(async () => notification), count: jest.fn(async () => 0) },
      notificationPreference: { findUnique: jest.fn(async () => preference) },
    } as unknown as PrismaService;
    const notifications = { unreadCount: jest.fn(async () => 0), toResponse: jest.fn((row: unknown) => row) } as unknown as NotificationsService;
    const stream = { publish } as unknown as NotificationStreamService;
    const webPush = { send } as unknown as WebPushService;
    return { service: new NotificationDeliveryService(prisma, notifications, stream, webPush), send, publish };
  }

  it('throws when the row is not visible yet so BullMQ retries past the commit', async () => {
    const { service, send } = build(null, null);
    await expect(service.deliver({ notificationId: 'n', userId: 'u' })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it('still fans out to the live stream but skips push when the recipient opted out of that type', async () => {
    const { service, send, publish } = build(
      { id: 'n', userId: 'u', type: 'WAITLIST_PROMOTED' },
      { perTypeChannelFlags: { WAITLIST_PROMOTED: { push: false } } },
    );
    await service.deliver({ notificationId: 'n', userId: 'u' });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('delivers push when enabled and stays idempotent across re-runs', async () => {
    const { service, send, publish } = build({ id: 'n', userId: 'u', type: 'WAITLIST_PROMOTED' }, null);
    await service.deliver({ notificationId: 'n', userId: 'u' });
    await service.deliver({ notificationId: 'n', userId: 'u' });
    expect(publish).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ notificationId: 'n', userId: 'u', type: 'WAITLIST_PROMOTED' });
  });
});
