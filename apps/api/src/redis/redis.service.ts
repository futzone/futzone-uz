import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;
  public constructor(config: ConfigService) {
    this.client = new Redis(config.get('REDIS_URL'), { lazyConnect: true, maxRetriesPerRequest: 1 });
  }
  public async onModuleDestroy(): Promise<void> { this.client.disconnect(); }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
