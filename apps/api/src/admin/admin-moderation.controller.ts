import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AdminDisputeResolveBodySchema,
  AdminReportActionBodySchema,
  AdminStadiumDecisionBodySchema,
  type AdminDisputeResolveBody,
  type AdminModerationActionResponse,
  type AdminModerationQueue,
  type AdminReportActionBody,
  type AdminStadiumDecisionBody,
} from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { AdminModerationService } from './admin-moderation.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('admin/moderation')
export class AdminModerationController {
  public constructor(private readonly moderation: AdminModerationService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Unified moderation queue: reports, disputes and stadium submissions' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminModerationQueue' } })
  public queue(): Promise<AdminModerationQueue> {
    return this.moderation.queue();
  }

  @Post('reports/:ratingId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide, restore or delete a reported rating-comment' })
  @ApiParam({ name: 'ratingId' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminModerationActionResponse' } })
  public resolveReport(@CurrentUserParam() actor: CurrentUser, @Param('ratingId') ratingId: string, @ZodBody(AdminReportActionBodySchema) body: AdminReportActionBody): Promise<AdminModerationActionResponse> {
    return this.moderation.resolveReport(actor.id, ratingId, body);
  }

  @Post('disputes/:recordId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uphold or overturn an attendance dispute' })
  @ApiParam({ name: 'recordId' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminModerationActionResponse' } })
  public resolveDispute(@CurrentUserParam() actor: CurrentUser, @Param('recordId') recordId: string, @ZodBody(AdminDisputeResolveBodySchema) body: AdminDisputeResolveBody): Promise<AdminModerationActionResponse> {
    return this.moderation.resolveDispute(actor.id, recordId, body);
  }

  @Post('stadiums/:stadiumId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a pending stadium submission' })
  @ApiParam({ name: 'stadiumId' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminModerationActionResponse' } })
  public resolveStadium(@CurrentUserParam() actor: CurrentUser, @Param('stadiumId') stadiumId: string, @ZodBody(AdminStadiumDecisionBodySchema) body: AdminStadiumDecisionBody): Promise<AdminModerationActionResponse> {
    return this.moderation.resolveStadium(actor.id, stadiumId, body);
  }
}
