import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES } from '@futzone/contracts';
import { type Job, Worker } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';
import { AdminMetricsService } from './admin-metrics.service';

@Injectable()
export class AdminMetricsWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  public constructor(
    private readonly config: ConfigService,
    private readonly metrics: AdminMetricsService,
  ) {}

  public onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.ADMIN_METRICS,
      async (job: Job) => {
        if (job.name === JOB_NAMES.ADMIN_METRICS_AGGREGATE) return this.metrics.aggregate();
        throw new Error(`Unsupported admin metrics job: ${job.name}`);
      },
      { connection: bullConnection(this.config.get('REDIS_URL')), prefix: this.config.get('BULLMQ_PREFIX'), concurrency: 1 },
    );
  }

  public async onModuleDestroy(): Promise<void> { await this.worker?.close(); }
}
