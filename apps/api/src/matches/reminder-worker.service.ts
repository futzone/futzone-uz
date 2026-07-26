import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES, type SendMatchReminderJobPayload } from '@futzone/contracts';
import { type Job, Worker } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { bullConnection } from '../users/avatar/avatar-queue.service';
import { ReminderProcessorService } from './reminder-processor.service';

@Injectable()
export class ReminderWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<SendMatchReminderJobPayload> | null = null;

  public constructor(
    private readonly config: ConfigService,
    private readonly processor: ReminderProcessorService,
  ) {}

  public onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.REMINDERS,
      async (job: Job<SendMatchReminderJobPayload>) => {
        if (job.name === JOB_NAMES.SEND_MATCH_REMINDER) return this.processor.sendReminder(job.data);
        throw new Error(`Unsupported reminder job: ${job.name}`);
      },
      {
        connection: bullConnection(this.config.get('REDIS_URL')),
        prefix: this.config.get('BULLMQ_PREFIX'),
        concurrency: 4,
      },
    );
  }

  public async onModuleDestroy(): Promise<void> { await this.worker?.close(); }
}
