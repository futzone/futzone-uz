import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceQueueService } from './attendance-queue.service';
import { AttendanceResolveGuard } from './attendance-resolve.guard';
import { AttendanceService } from './attendance.service';
import { StatsModule } from '../stats/stats.module';

@Module({
  imports: [AuthModule, forwardRef(() => MatchesModule), StatsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceQueueService, AttendanceResolveGuard],
  exports: [AttendanceService, AttendanceQueueService],
})
export class AttendanceModule {}
