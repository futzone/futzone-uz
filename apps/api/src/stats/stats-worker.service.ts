import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  JOB_NAMES,
  QUEUE_NAMES,
  type StatsReconcileJobPayload,
  type StatsUserJobPayload,
} from '@futzone/contracts';
import { type Job, Worker } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';
import { StatsService } from './stats.service';

@Injectable()
export class StatsWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<StatsUserJobPayload | StatsReconcileJobPayload> | null = null;

  public constructor(private readonly config: ConfigService, private readonly stats: StatsService) {}

  public onModuleInit(): void {
    this.worker = new Worker(QUEUE_NAMES.STATS, async (job: Job<StatsUserJobPayload | StatsReconcileJobPayload>) => {
      if (job.name === JOB_NAMES.ATTENDANCE_FINALIZED || job.name === JOB_NAMES.RATING_CHANGED)
        return this.stats.recomputeUser((job.data as StatsUserJobPayload).userId);
      if (job.name === JOB_NAMES.STATS_RECONCILE)
        return this.stats.reconcileAll();
      throw new Error(`Unsupported stats job: ${job.name}`);
    }, {
      connection: bullConnection(this.config.get('REDIS_URL')),
      prefix: this.config.get('BULLMQ_PREFIX'),
      concurrency: 2,
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
