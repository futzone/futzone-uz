import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisHealthService } from './redis-health.service';

@Injectable()
export class DependencyHealthIndicator extends HealthIndicator {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisHealthService,
  ) {
    super();
  }

  public async database(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus('db', true);
    } catch (error: unknown) {
      throw new HealthCheckError('Database check failed', this.getStatus('db', false, { message: error instanceof Error ? error.message : 'unknown error' }));
    }
  }

  public async redisPing(): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus('redis', true);
    } catch (error: unknown) {
      throw new HealthCheckError('Redis check failed', this.getStatus('redis', false, { message: error instanceof Error ? error.message : 'unknown error' }));
    }
  }
}
