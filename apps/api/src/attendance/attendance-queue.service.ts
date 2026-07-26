import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES, type AttendanceFallbackJobPayload, type AttendanceFinalizeJobPayload } from '@futzone/contracts';
import { Queue } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';

const FALLBACK_MS = 48 * 60 * 60_000;
const FINALIZE_MS = 72 * 60 * 60_000;
@Injectable()
export class AttendanceQueueService implements OnModuleDestroy {
  private readonly queue: Queue<AttendanceFallbackJobPayload | AttendanceFinalizeJobPayload>;
  public constructor(config: ConfigService) {
    this.queue = new Queue(QUEUE_NAMES.MATCH_STATE_TRANSITIONS, { connection: bullConnection(config.get('REDIS_URL')), prefix: config.get('BULLMQ_PREFIX') });
  }
  public async scheduleFallback(matchId: string, finishedAt = new Date()): Promise<void> {
    await this.queue.add(JOB_NAMES.ATTENDANCE_FALLBACK, { matchId }, { jobId: `attendance-fallback-${matchId}`, delay: Math.max(0, finishedAt.getTime() + FALLBACK_MS - Date.now()), removeOnComplete: 100, removeOnFail: 500 });
  }
  public async scheduleFinalization(recordId: string, markedAt: Date): Promise<void> {
    await this.cancelFinalization(recordId);
    await this.queue.add(JOB_NAMES.ATTENDANCE_FINALIZE, { recordId }, { jobId: `attendance-finalize-${recordId}`, delay: Math.max(0, markedAt.getTime() + FINALIZE_MS - Date.now()), removeOnComplete: 100, removeOnFail: 500 });
  }
  public async cancelFinalization(recordId: string): Promise<void> { const job = await this.queue.getJob(`attendance-finalize-${recordId}`); if (job) await job.remove(); }
  public async onModuleDestroy(): Promise<void> { await this.queue.close(); }
}
