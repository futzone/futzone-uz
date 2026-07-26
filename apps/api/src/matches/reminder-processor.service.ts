import { Injectable } from '@nestjs/common';
import type { SendMatchReminderJobPayload } from '@futzone/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReminderProcessorService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Fires a 24h/2h reminder to every currently-confirmed participant (a player who has since left
  // is simply no longer CONFIRMED). Idempotent: recipients who already received this reminder for
  // this match are skipped, so a retry never double-notifies.
  public async sendReminder(payload: SendMatchReminderJobPayload): Promise<void> {
    const match = await this.prisma.match.findFirst({
      where: { id: payload.matchId, deletedAt: null },
      select: { status: true },
    });
    if (!match || (match.status !== 'PUBLISHED' && match.status !== 'FULL')) return;
    const [participants, alreadyNotified] = await Promise.all([
      this.prisma.matchParticipant.findMany({ where: { matchId: payload.matchId, status: 'CONFIRMED' }, select: { userId: true } }),
      this.prisma.notification.findMany({ where: { matchId: payload.matchId, type: payload.notificationType }, select: { userId: true } }),
    ]);
    const seen = new Set(alreadyNotified.map((n) => n.userId));
    const recipients = participants.map((p) => p.userId).filter((id) => !seen.has(id));
    if (recipients.length) await this.notifications.notifyMany(recipients, payload.notificationType, {}, { matchId: payload.matchId });
  }
}
