import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AdminReasonBodySchema,
  AdminSuspendBodySchema,
  AdminUserSearchQuerySchema,
  AdminWarnBodySchema,
  type AdminReasonBody,
  type AdminSuspendBody,
  type AdminUserActionResponse,
  type AdminUserDetail,
  type AdminUserListResponse,
  type AdminUserSearchQuery,
  type AdminWarnBody,
} from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';

// Class default: ADMIN or MODERATOR. Destructive actions override to ADMIN-only (P5-10 matrix).
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('admin/users')
export class AdminUsersController {
  public constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search users by username, name or last digits of phone' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminUserListResponse' } })
  public search(@Query(new ZodValidationPipe(AdminUserSearchQuerySchema)) query: AdminUserSearchQuery): Promise<AdminUserListResponse> {
    return this.users.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'User detail with match, rating and report history' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminUserDetail' } })
  public detail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Post(':id/warn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Warn a user (sends a notification)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminUserActionResponse' } })
  public warn(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminWarnBodySchema) body: AdminWarnBody): Promise<AdminUserActionResponse> {
    return this.users.warn(actor.id, id, body);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Suspend a user until a date (ADMIN only)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminUserActionResponse' } })
  public suspend(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminSuspendBodySchema) body: AdminSuspendBody): Promise<AdminUserActionResponse> {
    return this.users.suspend(actor.id, id, body);
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ban a user (ADMIN only)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminUserActionResponse' } })
  public ban(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminReasonBodySchema) body: AdminReasonBody): Promise<AdminUserActionResponse> {
    return this.users.ban(actor.id, id, body);
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reinstate a banned or suspended user (ADMIN only)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminUserActionResponse' } })
  public unban(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminReasonBodySchema) body: AdminReasonBody): Promise<AdminUserActionResponse> {
    return this.users.unban(actor.id, id, body);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mark a user phone as verified (ADMIN only)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AdminUserActionResponse' } })
  public verify(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string, @ZodBody(AdminReasonBodySchema) body: AdminReasonBody): Promise<AdminUserActionResponse> {
    return this.users.markVerified(actor.id, id, body);
  }
}
