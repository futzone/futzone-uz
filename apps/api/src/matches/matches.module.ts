import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchStateService } from './match-state.service';
import { MatchParticipationService } from './match-participation.service';
import { MatchQueueService } from './match-queue.service';
import { MatchJobProcessorService } from './match-job-processor.service';
import { MatchWorkerService } from './match-worker.service';
import { MatchActionGuard } from './match-action.guard';
import { MatchInvitationsService } from './match-invitations.service';
import { ReminderProcessorService } from './reminder-processor.service';
import { ReminderWorkerService } from './reminder-worker.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AuthModule, forwardRef(() => AttendanceModule)],
  controllers: [MatchesController],
  providers: [MatchesService, MatchParticipationService, MatchInvitationsService, MatchStateService, MatchQueueService, MatchJobProcessorService, MatchWorkerService, ReminderProcessorService, ReminderWorkerService, MatchActionGuard],
  exports: [MatchesService, MatchStateService, MatchQueueService, MatchActionGuard],
})
export class MatchesModule {}
