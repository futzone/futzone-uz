import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminDashboardResponse } from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminMetricsService } from './admin-metrics.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminDashboardController {
  public constructor(private readonly metrics: AdminMetricsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Dashboard metrics: latest snapshot plus a 30-day series' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminDashboardResponse' } })
  public dashboard(): Promise<AdminDashboardResponse> {
    return this.metrics.dashboard();
  }
}
