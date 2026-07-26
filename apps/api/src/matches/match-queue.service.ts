import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  JOB_NAMES,
  QUEUE_NAMES,
  type MatchTransitionJobPayload,
  type SendMatchReminderJobPayload,
  type WaitlistPromotionExpiryJobPayload,
  type RatingWindowCloseJobPayload,
} from '@futzone/contracts';
import { Queue } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';
import { reminderWindows } from './reminder-schedule';

const START_JOB_PREFIX = 'match-start-';
const FINISH_JOB_PREFIX = 'match-finish-';
const PROMOTION_JOB_PREFIX = 'waitlist-promotion-';
const REMINDER_PREFIXES: Record<string, string> = { MATCH_REMINDER_24H: 'reminder-24h-', MATCH_REMINDER_2H: 'reminder-2h-' };

@Injectable()
export class MatchQueueService implements OnModuleDestroy {
  private readonly queue: Queue<MatchTransitionJobPayload | WaitlistPromotionExpiryJobPayload | RatingWindowCloseJobPayload>;
  private readonly reminders: Queue<SendMatchReminderJobPayload>;

  public constructor(config: ConfigService) {
    const connection = bullConnection(config.get('REDIS_URL'));
    const prefix = config.get('BULLMQ_PREFIX');
    this.queue = new Queue(QUEUE_NAMES.MATCH_STATE_TRANSITIONS, { connection, prefix });
    this.reminders = new Queue(QUEUE_NAMES.REMINDERS, { connection, prefix });
  }

  public async scheduleMatch(matchId: string, startsAt: Date, durationMin: number): Promise<void> {
    await this.cancelMatch(matchId);
    const finishAt = new Date(startsAt.getTime() + durationMin * 60_000);
    await Promise.all([
      this.queue.add(JOB_NAMES.MATCH_START, { matchId }, {
        jobId: `${START_JOB_PREFIX}${matchId}`,
        delay: Math.max(0, startsAt.getTime() - Date.now()),
        removeOnComplete: 100,
        removeOnFail: 500,
      }),
      this.queue.add(JOB_NAMES.MATCH_FINISH, { matchId }, {
        jobId: `${FINISH_JOB_PREFIX}${matchId}`,
        delay: Math.max(0, finishAt.getTime() - Date.now()),
        removeOnComplete: 100,
        removeOnFail: 500,
      }),
    ]);
  }

  public async cancelMatch(matchId: string): Promise<void> {
    await Promise.all([
      this.removeJob(`${START_JOB_PREFIX}${matchId}`),
      this.removeJob(`${FINISH_JOB_PREFIX}${matchId}`),
    ]);
  }

  public async hasScheduledMatchJobs(matchId: string): Promise<boolean> {
    const jobs = await Promise.all([
      this.queue.getJob(`${START_JOB_PREFIX}${matchId}`),
      this.queue.getJob(`${FINISH_JOB_PREFIX}${matchId}`),
    ]);
    return jobs.some((job) => job !== undefined);
  }

  public async schedulePromotion(payload: WaitlistPromotionExpiryJobPayload): Promise<void> {
    await this.queue.add(JOB_NAMES.WAITLIST_PROMOTION_EXPIRE, payload, {
      jobId: `${PROMOTION_JOB_PREFIX}${payload.participantId}`,
      delay: Math.max(0, new Date(payload.expiresAt).getTime() - Date.now()),
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  public async cancelPromotion(participantId: string): Promise<void> {
    await this.removeJob(`${PROMOTION_JOB_PREFIX}${participantId}`);
  }

  public async scheduleRatingWindowClose(matchId: string, closesAt: Date): Promise<void> {
    await this.queue.add(JOB_NAMES.RATING_WINDOW_CLOSE, { matchId }, {
      jobId: `rating-window-close-${matchId}`,
      delay: Math.max(0, closesAt.getTime() - Date.now()),
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  // Schedule the 24h/2h reminders for a match, replacing any existing ones. A reminder whose fire
  // time has already passed (e.g. a match published <24h out) is simply not scheduled.
  public async scheduleReminders(matchId: string, startsAt: Date): Promise<void> {
    await this.cancelReminders(matchId);
    const now = new Date();
    await Promise.all(reminderWindows(startsAt, now).map(({ notificationType, fireAt }) =>
      this.reminders.add(
        JOB_NAMES.SEND_MATCH_REMINDER,
        { matchId, scheduledFor: fireAt.toISOString(), notificationType } satisfies SendMatchReminderJobPayload,
        { jobId: `${REMINDER_PREFIXES[notificationType]}${matchId}`, delay: fireAt.getTime() - now.getTime(), removeOnComplete: 100, removeOnFail: 500 },
      ),
    ));
  }

  public async cancelReminders(matchId: string): Promise<void> {
    await Promise.all(Object.values(REMINDER_PREFIXES).map((prefix) => this.removeReminderJob(`${prefix}${matchId}`)));
  }

  public async hasScheduledReminders(matchId: string): Promise<boolean> {
    const jobs = await Promise.all(Object.values(REMINDER_PREFIXES).map((prefix) => this.reminders.getJob(`${prefix}${matchId}`)));
    return jobs.some((job) => job !== undefined);
  }

  private async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) await job.remove();
  }

  private async removeReminderJob(jobId: string): Promise<void> {
    const job = await this.reminders.getJob(jobId);
    if (job) await job.remove();
  }

  public async onModuleDestroy(): Promise<void> {
    await Promise.all([this.queue.close(), this.reminders.close()]);
  }
}
