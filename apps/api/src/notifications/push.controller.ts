import { Controller, Delete, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PushSubscriptionBodySchema,
  PushUnsubscribeBodySchema,
  type PushSubscriptionBody,
  type PushSubscriptionMutationResponse,
  type PushUnsubscribeBody,
  type VapidPublicKeyResponse,
} from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';

@ApiTags('notifications')
@Controller()
export class PushController {
  public constructor(
    private readonly notifications: NotificationsService,
    private readonly webPush: WebPushService,
  ) {}

  @Get('push/vapid-public-key')
  @ApiOperation({ summary: 'The server VAPID public key (null when push is disabled)' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/VapidPublicKeyResponse' } })
  public vapidPublicKey(): VapidPublicKeyResponse {
    return { publicKey: this.webPush.publicKey };
  }

  @Post('me/push/subscriptions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a Web Push subscription for the current device' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/PushSubscriptionMutationResponse' } })
  public async subscribe(
    @CurrentUserParam() user: CurrentUser,
    @ZodBody(PushSubscriptionBodySchema) body: PushSubscriptionBody,
  ): Promise<PushSubscriptionMutationResponse> {
    await this.notifications.savePushSubscription(user.id, body);
    return { subscribed: true };
  }

  @Delete('me/push/subscriptions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a Web Push subscription for the current device' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/PushSubscriptionMutationResponse' } })
  public async unsubscribe(
    @CurrentUserParam() user: CurrentUser,
    @ZodBody(PushUnsubscribeBodySchema) body: PushUnsubscribeBody,
  ): Promise<PushSubscriptionMutationResponse> {
    await this.notifications.deletePushSubscription(user.id, body.endpoint);
    return { subscribed: false };
  }
}
