import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { StatsModule } from '../stats/stats.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminAuditController } from './admin-audit.controller';
import { AdminMatchesController } from './admin-matches.controller';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminMetricsQueueService } from './admin-metrics-queue.service';
import { AdminMetricsWorkerService } from './admin-metrics-worker.service';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminMatchesService } from './admin-matches.service';
import { AdminModerationService } from './admin-moderation.service';
import { AuditService } from './audit.service';

@Module({
  imports: [AuthModule, MatchesModule, AttendanceModule, StatsModule],
  controllers: [AdminDashboardController, AdminUsersController, AdminAuditController, AdminMatchesController, AdminModerationController],
  providers: [
    AdminMetricsService,
    AdminMetricsQueueService,
    AdminMetricsWorkerService,
    AdminUsersService,
    AdminAuditService,
    AdminMatchesService,
    AdminModerationService,
    AuditService,
    RolesGuard,
  ],
  exports: [AuditService],
})
export class AdminModule {}
