import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  JOB_NAMES,
  QUEUE_NAMES,
  type MatchTransitionJobPayload,
  type WaitlistPromotionExpiryJobPayload,
  type AttendanceFallbackJobPayload,
  type AttendanceFinalizeJobPayload,
  type RatingWindowCloseJobPayload,
} from '@futzone/contracts';
import { type Job, Worker } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';
import { MatchJobProcessorService } from './match-job-processor.service';

type MatchJobPayload = MatchTransitionJobPayload | WaitlistPromotionExpiryJobPayload | AttendanceFallbackJobPayload | AttendanceFinalizeJobPayload | RatingWindowCloseJobPayload;

@Injectable()
export class MatchWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<MatchJobPayload> | null = null;
  public constructor(
    private readonly config: ConfigService,
    private readonly processor: MatchJobProcessorService,
  ) {}
  public onModuleInit(): void {
    this.worker = new Worker(QUEUE_NAMES.MATCH_STATE_TRANSITIONS, async (job: Job<MatchJobPayload>) => {
      if (job.name === JOB_NAMES.MATCH_START)
        return this.processor.start(job.data as MatchTransitionJobPayload);
      if (job.name === JOB_NAMES.MATCH_FINISH)
        return this.processor.finish(job.data as MatchTransitionJobPayload);
      if (job.name === JOB_NAMES.WAITLIST_PROMOTION_EXPIRE)
        return this.processor.expirePromotion(job.data as WaitlistPromotionExpiryJobPayload);
      if (job.name === JOB_NAMES.ATTENDANCE_FALLBACK)
        return this.processor.fallback(job.data as AttendanceFallbackJobPayload);
      if (job.name === JOB_NAMES.ATTENDANCE_FINALIZE)
        return this.processor.finalize(job.data as AttendanceFinalizeJobPayload);
      if (job.name === JOB_NAMES.RATING_WINDOW_CLOSE)
        return this.processor.closeRatingWindow(job.data as RatingWindowCloseJobPayload);
      throw new Error(`Unsupported match job: ${job.name}`);
    }, {
      connection: bullConnection(this.config.get('REDIS_URL')),
      prefix: this.config.get('BULLMQ_PREFIX'),
      concurrency: 2,
    });
  }
  public async onModuleDestroy(): Promise<void> { await this.worker?.close(); }
}
