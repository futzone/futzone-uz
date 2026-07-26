import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DependencyHealthIndicator } from './dependency-health.indicator';
import { HealthController } from './health.controller';
import { RedisHealthService } from './redis-health.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DependencyHealthIndicator, RedisHealthService],
})
export class HealthModule {}
