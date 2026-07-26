import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AdminFlagBodySchema,
  AdminMatchSearchQuerySchema,
  AdminReasonBodySchema,
  UpdateMatchBodySchema,
  type AdminFlagBody,
  type AdminMatchActionResponse,
  type AdminMatchDetail,
  type AdminMatchListResponse,
  type AdminMatchSearchQuery,
  type AdminReasonBody,
  type UpdateMatchBody,
} from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AdminMatchesService } from './admin-matches.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/matches')
export class AdminMatchesController {
  public constructor(private readonly matches: AdminMatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Search matches by title, status or flagged state' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminMatchListResponse' } })
  public search(@Query(new ZodValidationPipe(AdminMatchSearchQuerySchema)) query: AdminMatchSearchQuery): Promise<AdminMatchListResponse> {
    return this.matches.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Match detail with participants and audit trail' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminMatchDetail' } })
  public detail(@Param('id') id: string): Promise<AdminMatchDetail> {
    return this.matches.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a match (audited)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminMatchDetail' } })
  public edit(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(UpdateMatchBodySchema) body: UpdateMatchBody): Promise<AdminMatchDetail> {
    return this.matches.edit(actor.id, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-cancel a match; all active participants are notified' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminMatchActionResponse' } })
  public cancel(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminReasonBodySchema) body: AdminReasonBody): Promise<AdminMatchActionResponse> {
    return this.matches.forceCancel(actor.id, id, body);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flag a match as suspicious' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminMatchActionResponse' } })
  public flag(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminFlagBodySchema) body: AdminFlagBody): Promise<AdminMatchActionResponse> {
    return this.matches.flag(actor.id, id, body);
  }

  @Post(':id/unflag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the suspicious flag on a match' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminMatchActionResponse' } })
  public unflag(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminReasonBodySchema) body: AdminReasonBody): Promise<AdminMatchActionResponse> {
    return this.matches.unflag(actor.id, id, body);
  }
}
