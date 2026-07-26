import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly client: Redis;

  public constructor(config: ConfigService) {
    this.client = new Redis(config.get('REDIS_URL'), { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  public async ping(): Promise<void> {
    if (this.client.status === 'wait') await this.client.connect();
    const response = await this.client.ping();
    if (response !== 'PONG') throw new Error(`Unexpected Redis response: ${response}`);
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') this.client.disconnect();
  }
}
