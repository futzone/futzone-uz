import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { ReminderProcessorService } from './reminder-processor.service';

function build(options: {
  status?: string | null;
  confirmed?: string[];
  alreadyNotified?: string[];
}): { service: ReminderProcessorService; notifyMany: jest.Mock } {
  const notifyMany = jest.fn(async () => undefined);
  const prisma = {
    match: { findFirst: jest.fn(async () => (options.status === null ? null : { status: options.status ?? 'PUBLISHED' })) },
    matchParticipant: { findMany: jest.fn(async () => (options.confirmed ?? []).map((userId) => ({ userId }))) },
    notification: { findMany: jest.fn(async () => (options.alreadyNotified ?? []).map((userId) => ({ userId }))) },
  } as unknown as PrismaService;
  const notifications = { notifyMany } as unknown as NotificationsService;
  return { service: new ReminderProcessorService(prisma, notifications), notifyMany };
}

const payload = { matchId: 'm', scheduledFor: '2026-07-26T12:00:00.000Z', notificationType: 'MATCH_REMINDER_24H' as const };

describe('ReminderProcessorService', () => {
  it('notifies every confirmed participant of an active match', async () => {
    const { service, notifyMany } = build({ status: 'FULL', confirmed: ['u1', 'u2'] });
    await service.sendReminder(payload);
    expect(notifyMany).toHaveBeenCalledWith(['u1', 'u2'], 'MATCH_REMINDER_24H', {}, { matchId: 'm' });
  });

  it('is idempotent — skips participants who already received this reminder', async () => {
    const { service, notifyMany } = build({ confirmed: ['u1', 'u2', 'u3'], alreadyNotified: ['u1', 'u3'] });
    await service.sendReminder(payload);
    expect(notifyMany).toHaveBeenCalledWith(['u2'], 'MATCH_REMINDER_24H', {}, { matchId: 'm' });
  });

  it('does nothing when everyone already got it', async () => {
    const { service, notifyMany } = build({ confirmed: ['u1'], alreadyNotified: ['u1'] });
    await service.sendReminder(payload);
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it('does not fire for a cancelled or finished match', async () => {
    const { service, notifyMany } = build({ status: 'CANCELLED', confirmed: ['u1'] });
    await service.sendReminder(payload);
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it('does not fire when the match no longer exists', async () => {
    const { service, notifyMany } = build({ status: null });
    await service.sendReminder(payload);
    expect(notifyMany).not.toHaveBeenCalled();
  });
});
