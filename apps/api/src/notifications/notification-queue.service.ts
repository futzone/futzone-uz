import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES, type DeliverNotificationJobPayload } from '@futzone/contracts';
import { Queue } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly queue: Queue<DeliverNotificationJobPayload>;

  public constructor(config: ConfigService) {
    this.queue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
      connection: bullConnection(config.get('REDIS_URL')),
      prefix: config.get('BULLMQ_PREFIX'),
    });
  }

  public async enqueueDelivery(payload: DeliverNotificationJobPayload): Promise<void> {
    // The row is usually written inside the caller's DB transaction; a short delay lets the commit
    // land before the worker reads it, and attempts/backoff cover a slow commit (the worker throws
    // until the row is visible). jobId dedupes accidental double-enqueues of the same notification.
    await this.queue.add(JOB_NAMES.DELIVER_NOTIFICATION, payload, {
      jobId: `deliver-${payload.notificationId}`,
      delay: 500,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
