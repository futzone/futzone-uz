import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AvatarCompleteBodySchema, AvatarPresignBodySchema, type AvatarCompleteBody, type AvatarPresignBody, type AvatarPresignResponse } from '@futzone/contracts';
import { AuthGuard } from '../../auth/auth.guard';
import type { CurrentUser } from '../../auth/auth.types';
import { CurrentUserParam } from '../../auth/current-user.decorator';
import { ZodBody } from '../../common/validation/zod-body.decorator';
import { AvatarService } from './avatar.service';

@ApiTags('profile')
@Controller('me/avatar')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AvatarController {
  public constructor(private readonly avatars: AvatarService) {}
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create an exact-size presigned avatar PUT URL' })
  @ApiBody({ schema: { $ref: '#/components/schemas/AvatarPresignBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AvatarPresignResponse' } })
  @ApiBadRequestResponse({ description: 'Invalid or oversized avatar size' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  public presign(@CurrentUserParam() user: CurrentUser, @ZodBody(AvatarPresignBodySchema) body: AvatarPresignBody): Promise<AvatarPresignResponse> { return this.avatars.presign(user.id, body.size); }

  @Post('complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate and enqueue a completed avatar upload' })
  @ApiBody({ schema: { $ref: '#/components/schemas/AvatarCompleteBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AvatarCompleteResponse' } })
  @ApiBadRequestResponse({ description: 'Invalid size or file magic bytes' })
  @ApiForbiddenResponse({ description: 'Object does not belong to the caller' })
  @ApiNotFoundResponse({ description: 'Upload record or object not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  public complete(@CurrentUserParam() user: CurrentUser, @ZodBody(AvatarCompleteBodySchema) body: AvatarCompleteBody): Promise<{ accepted: true }> { return this.avatars.complete(user.id, body.objectKey); }
}
