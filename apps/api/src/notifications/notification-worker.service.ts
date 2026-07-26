import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES, type DeliverNotificationJobPayload } from '@futzone/contracts';
import { type Job, Worker } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';
import { NotificationDeliveryService } from './notification-delivery.service';

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<DeliverNotificationJobPayload> | null = null;

  public constructor(
    private readonly config: ConfigService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  public onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job: Job<DeliverNotificationJobPayload>) => {
        if (job.name === JOB_NAMES.DELIVER_NOTIFICATION) return this.delivery.deliver(job.data);
        throw new Error(`Unsupported notification job: ${job.name}`);
      },
      {
        connection: bullConnection(this.config.get('REDIS_URL')),
        prefix: this.config.get('BULLMQ_PREFIX'),
        concurrency: 4,
      },
    );
  }

  public async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
