import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  JOB_NAMES,
  QUEUE_NAMES,
  type StatsReconcileJobPayload,
  type StatsUserJobPayload,
} from '@futzone/contracts';
import { Queue } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';

@Injectable()
export class StatsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queue: Queue<StatsUserJobPayload | StatsReconcileJobPayload>;

  public constructor(config: ConfigService) {
    this.queue = new Queue(QUEUE_NAMES.STATS, {
      connection: bullConnection(config.get('REDIS_URL')),
      prefix: config.get('BULLMQ_PREFIX'),
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'stats-nightly-reconcile',
      { pattern: '0 0 * * *' },
      { name: JOB_NAMES.STATS_RECONCILE, data: { refreshGlobalMean: true } },
    );
  }

  public async attendanceFinalized(userId: string): Promise<void> {
    await this.queue.add(JOB_NAMES.ATTENDANCE_FINALIZED, { userId }, {
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  public async ratingChanged(userId: string): Promise<void> {
    await this.queue.add(JOB_NAMES.RATING_CHANGED, { userId }, {
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
