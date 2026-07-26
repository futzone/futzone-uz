import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES } from '@futzone/contracts';
import { Queue } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';

@Injectable()
export class AdminMetricsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queue: Queue;

  public constructor(config: ConfigService) {
    this.queue = new Queue(QUEUE_NAMES.ADMIN_METRICS, {
      connection: bullConnection(config.get('REDIS_URL')),
      prefix: config.get('BULLMQ_PREFIX'),
    });
  }

  // Registers the nightly (02:00 UTC) aggregation. upsert => idempotent across restarts.
  public async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler('admin-metrics-daily', { pattern: '0 2 * * *' }, { name: JOB_NAMES.ADMIN_METRICS_AGGREGATE, data: {} });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
