import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES, type ProcessAvatarJobPayload } from '@futzone/contracts';
import { Queue } from 'bullmq';
import { ConfigService } from '../../config/config.service';

export function bullConnection(redisUrl: string): { host: string; port: number; username?: string; password?: string; db: number; tls?: Record<string, never> } {
  const url = new URL(redisUrl);
  const database = Number(url.pathname.slice(1) || '0');
  return {
    host: url.hostname, port: Number(url.port || (url.protocol === 'rediss:' ? 6380 : 6379)),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined, db: database,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

@Injectable()
export class AvatarQueueService implements OnModuleDestroy {
  private readonly queue: Queue<ProcessAvatarJobPayload>;
  public constructor(config: ConfigService) {
    this.queue = new Queue(QUEUE_NAMES.AVATAR_PROCESSING, {
      connection: bullConnection(config.get('REDIS_URL')),
      prefix: config.get('BULLMQ_PREFIX'),
    });
  }
  public async enqueue(payload: ProcessAvatarJobPayload): Promise<void> {
    const jobId = payload.processedKey.split('/').at(-1)?.replace('.webp', '');
    await this.queue.add(JOB_NAMES.PROCESS_AVATAR, payload, { jobId, attempts: 5, backoff: { type: 'exponential', delay: 1_000 }, removeOnComplete: 100, removeOnFail: 500 });
  }
  public async onModuleDestroy(): Promise<void> { await this.queue.close(); }
}
