import { Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Sse, UseGuards, type MessageEvent } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  NotificationListQuerySchema,
  UpdateNotificationPreferenceBodySchema,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationPreference,
  type UnreadCountResponse,
  type UpdateNotificationPreferenceBody,
} from '@futzone/contracts';
import type { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { NotificationsService } from './notifications.service';
import { NotificationStreamService } from './notification-stream.service';
import { SseAuthGuard } from './sse-auth.guard';

@ApiTags('notifications')
@Controller('me/notifications')
export class NotificationsController {
  public constructor(
    private readonly notifications: NotificationsService,
    private readonly streamService: NotificationStreamService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current user's notifications (most recent first)" })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/NotificationListResponse' } })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  public list(
    @CurrentUserParam() user: CurrentUser,
    @Query(new ZodValidationPipe(NotificationListQuerySchema)) query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Number of unread notifications for the current user' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/UnreadCountResponse' } })
  public async unreadCount(@CurrentUserParam() user: CurrentUser): Promise<UnreadCountResponse> {
    return { unreadCount: await this.notifications.unreadCount(user.id) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark every notification read' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/UnreadCountResponse' } })
  public async markAllRead(@CurrentUserParam() user: CurrentUser): Promise<UnreadCountResponse> {
    return { unreadCount: await this.notifications.markAllRead(user.id) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a single notification read' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/UnreadCountResponse' } })
  public async markRead(@CurrentUserParam() user: CurrentUser, @Param('id') id: string): Promise<UnreadCountResponse> {
    return { unreadCount: await this.notifications.markRead(user.id, id) };
  }

  @Get('preferences')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the per-type push notification preferences' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/NotificationPreference' } })
  public getPreferences(@CurrentUserParam() user: CurrentUser): Promise<NotificationPreference> {
    return this.notifications.getPreference(user.id);
  }

  @Put('preferences')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace the per-type push notification preferences' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/NotificationPreference' } })
  public updatePreferences(
    @CurrentUserParam() user: CurrentUser,
    @ZodBody(UpdateNotificationPreferenceBodySchema) body: UpdateNotificationPreferenceBody,
  ): Promise<NotificationPreference> {
    return this.notifications.updatePreference(user.id, body);
  }

  // Live stream of newly delivered notifications. Authenticated by access token in the query string
  // because EventSource cannot send an Authorization header.
  @Sse('stream')
  @UseGuards(SseAuthGuard)
  @ApiOperation({ summary: 'Server-sent stream of new notifications (token in query string)' })
  @ApiQuery({ name: 'token', required: true })
  public stream(@CurrentUserParam() user: CurrentUser): Observable<MessageEvent> {
    return this.streamService.subscribe(user.id);
  }
}
