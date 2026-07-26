import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES, type ProcessAvatarJobPayload } from '@futzone/contracts';
import { type Job, Worker } from 'bullmq';
import { ConfigService } from '../../config/config.service';
import { bullConnection } from './avatar-queue.service';
import { AvatarProcessorService } from './avatar-processor.service';

@Injectable()
export class AvatarWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<ProcessAvatarJobPayload> | null = null;
  public constructor(private readonly config: ConfigService, private readonly processor: AvatarProcessorService) {}
  public onModuleInit(): void {
    this.worker = new Worker(QUEUE_NAMES.AVATAR_PROCESSING, async (job: Job<ProcessAvatarJobPayload>) => {
      if (job.name !== JOB_NAMES.PROCESS_AVATAR) throw new Error(`Unsupported avatar job: ${job.name}`);
      await this.processor.process(job.data);
    }, {
      connection: bullConnection(this.config.get('REDIS_URL')),
      prefix: this.config.get('BULLMQ_PREFIX'),
      concurrency: 2,
    });
  }
  public async onModuleDestroy(): Promise<void> { await this.worker?.close(); }
}
