import { Module } from '@nestjs/common';
import { StatsQueueService } from './stats-queue.service';
import { StatsService } from './stats.service';
import { StatsWorkerService } from './stats-worker.service';

@Module({
  providers: [StatsQueueService, StatsService, StatsWorkerService],
  exports: [StatsQueueService],
})
export class StatsModule {}
