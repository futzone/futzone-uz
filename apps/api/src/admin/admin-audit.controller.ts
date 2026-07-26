import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuditQuerySchema, type AdminAuditListResponse, type AdminAuditQuery } from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AdminAuditService } from './admin-audit.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/audit-logs')
export class AdminAuditController {
  public constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Filterable, read-only audit log (actor/action/target/date)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminAuditListResponse' } })
  public list(@Query(new ZodValidationPipe(AdminAuditQuerySchema)) query: AdminAuditQuery): Promise<AdminAuditListResponse> {
    return this.audit.list(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  @ApiOperation({ summary: 'Export the filtered audit log as CSV' })
  public export(@Query(new ZodValidationPipe(AdminAuditQuerySchema)) query: AdminAuditQuery): Promise<string> {
    return this.audit.exportCsv(query);
  }
}
