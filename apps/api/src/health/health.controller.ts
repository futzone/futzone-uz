import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { DependencyHealthIndicator } from './dependency-health.indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  public constructor(
    private readonly health: HealthCheckService,
    private readonly dependencies: DependencyHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check database and Redis readiness' })
  @ApiOkResponse({ description: 'All dependencies are healthy' })
  @ApiServiceUnavailableResponse({ description: 'A named dependency is unhealthy' })
  public check(): Promise<HealthCheckResult> {
    return this.health.check([
      (): ReturnType<DependencyHealthIndicator['database']> => this.dependencies.database(),
      (): ReturnType<DependencyHealthIndicator['redisPing']> => this.dependencies.redisPing(),
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Check process liveness' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  public live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
