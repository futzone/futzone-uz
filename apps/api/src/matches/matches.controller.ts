import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CancelMatchBodySchema,
  CreateMatchBodySchema,
  AssignAssistantBodySchema,
  InviteByUsernameBodySchema,
  JoinMatchBodySchema,
  JoinWaitlistBodySchema,
  MatchesQuerySchema,
  UpdateMatchBodySchema,
  UpdateMyParticipationBodySchema,
  type CancelMatchBody,
  type CreateMatchBody,
  type AssignAssistantBody,
  type Invitation,
  type InviteByUsernameBody,
  type JoinMatchBody,
  type JoinMatchResponse,
  type JoinWaitlistBody,
  type JoinRequest,
  type JoinRequestWithSummary,
  type Match, type MatchDetail,
  type MatchesResponse,
  type MatchSearchQuery,
  type MatchParticipant,
  type ShareInvitation,
  type UpdateMatchBody,
  type UpdateMyParticipationBody,
} from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { MatchesService } from './matches.service';
import { MatchParticipationService } from './match-participation.service';
import { MatchInvitationsService } from './match-invitations.service';
import { MatchActionGuard } from './match-action.guard';
import { RequireMatchAction } from './match-action.decorator';
import { MATCH_ACTIONS } from './match-permissions.policy';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  public constructor(
    private readonly matches: MatchesService,
    private readonly participation: MatchParticipationService,
    private readonly invitations: MatchInvitationsService,
  ) {}

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join or request to join a published match' })
  @ApiBody({ schema: { $ref: '#/components/schemas/JoinMatchBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/JoinMatchResponse' } })
  @ApiConflictResponse({ description: 'Match full, already joined, or overlapping match' })
  public join(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
    @ZodBody(JoinMatchBodySchema) body: JoinMatchBody,
  ): Promise<JoinMatchResponse> {
    return this.participation.join(id, user.id, body);
  }

  @Post(':id/waitlist')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a match waitlist' })
  @ApiBody({ schema: { $ref: '#/components/schemas/JoinWaitlistBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public joinWaitlist(@CurrentUserParam() user: CurrentUser, @Param('id') id: string, @ZodBody(JoinWaitlistBodySchema) body: JoinWaitlistBody): Promise<MatchParticipant> {
    return this.participation.joinWaitlist(id, user.id, body);
  }

  @Post(':id/waitlist/leave')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a match waitlist or decline an active promotion' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public leaveWaitlist(@CurrentUserParam() user: CurrentUser, @Param('id') id: string): Promise<MatchParticipant> {
    return this.participation.leaveWaitlist(id, user.id);
  }

  @Post(':id/waitlist/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm an active waitlist promotion' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public confirmWaitlist(@CurrentUserParam() user: CurrentUser, @Param('id') id: string): Promise<MatchParticipant> {
    return this.participation.confirmPromotion(id, user.id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a match' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public leave(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<MatchParticipant> {
    return this.participation.leave(id, user.id);
  }

  @Patch(':id/participants/me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own guest count' })
  @ApiBody({ schema: { $ref: '#/components/schemas/UpdateMyParticipationBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public updateMine(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
    @ZodBody(UpdateMyParticipationBodySchema) body: UpdateMyParticipationBody,
  ): Promise<MatchParticipant> {
    return this.participation.updateMine(id, user.id, body);
  }

  @Post(':id/participants/:userId/remove')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.REMOVE_PARTICIPANT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a participant as owner or assistant' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public remove(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<MatchParticipant> {
    return this.participation.remove(id, userId);
  }

  @Post(':id/requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.DECIDE_REQUEST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a pending join request' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/JoinRequest' } })
  public approve(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ): Promise<JoinRequest> {
    return this.participation.decideRequest(id, user.id, requestId, 'APPROVED');
  }

  @Post(':id/requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.DECIDE_REQUEST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending join request' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/JoinRequest' } })
  public reject(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ): Promise<JoinRequest> {
    return this.participation.decideRequest(id, user.id, requestId, 'REJECTED');
  }

  @Get(':id/requests')
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.VIEW_REQUESTS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List pending join requests with requester summaries' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/JoinRequestsResponse' } })
  public requests(@Param('id') id: string): Promise<JoinRequestWithSummary[]> {
    return this.participation.listRequests(id);
  }

  @Post(':id/invitations')
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.INVITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a user by username' })
  @ApiBody({ schema: { $ref: '#/components/schemas/InviteByUsernameBody' } })
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/Invitation' } })
  public invite(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
    @ZodBody(InviteByUsernameBodySchema) body: InviteByUsernameBody,
  ): Promise<Invitation> {
    return this.invitations.inviteByUsername(id, user.id, body);
  }

  @Post(':id/invitations/share')
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.INVITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mint a single-use share invitation link' })
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/ShareInvitation' } })
  public shareInvitation(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<ShareInvitation> {
    return this.invitations.mintShareLink(id, user.id);
  }

  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a share invitation and join through the standard transaction' })
  @ApiBody({ schema: { $ref: '#/components/schemas/JoinMatchBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/JoinMatchResponse' } })
  public acceptInvitation(
    @CurrentUserParam() user: CurrentUser,
    @Param('token') token: string,
    @ZodBody(JoinMatchBodySchema) body: JoinMatchBody,
  ): Promise<JoinMatchResponse> {
    return this.invitations.acceptToken(token, user.id, body);
  }

  @Post(':id/assistants')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.ASSIGN_ASSISTANT)
  @ApiBearerAuth()
  @ApiBody({ schema: { $ref: '#/components/schemas/AssignAssistantBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public assignAssistant(
    @Param('id') id: string,
    @ZodBody(AssignAssistantBodySchema) body: AssignAssistantBody,
  ): Promise<MatchParticipant> {
    return this.participation.assignAssistant(id, body.userId);
  }

  @Post(':id/assistants/:userId/remove')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.ASSIGN_ASSISTANT)
  @ApiBearerAuth()
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchParticipant' } })
  public removeAssistant(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<MatchParticipant> {
    return this.participation.removeAssistant(id, userId);
  }
  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a draft match' })
  @ApiBody({ schema: { $ref: '#/components/schemas/CreateMatchBody' } })
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/Match' } })
  @ApiBadRequestResponse({ description: 'Invalid match data' })
  public create(
    @CurrentUserParam() user: CurrentUser,
    @ZodBody(CreateMatchBodySchema) body: CreateMatchBody,
  ): Promise<Match> {
    return this.matches.create(user.id, body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.EDIT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a match owned by the authenticated user' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: { $ref: '#/components/schemas/UpdateMatchBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/Match' } })
  @ApiForbiddenResponse({
    description: 'Caller is not the owner or field is immutable after publication',
  })
  @ApiConflictResponse({ description: 'Capacity is lower than current occupancy' })
  public update(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
    @ZodBody(UpdateMatchBodySchema) body: UpdateMatchBody,
  ): Promise<Match> {
    return this.matches.update(id, user.id, body);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.PUBLISH)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish an owned draft match' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/Match' } })
  @ApiConflictResponse({ description: 'Invalid match state transition' })
  public publish(@Param('id') id: string): Promise<Match> {
    return this.matches.publish(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.CANCEL)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an owned match' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: { $ref: '#/components/schemas/CancelMatchBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/Match' } })
  @ApiBadRequestResponse({ description: 'Cancellation reason is required' })
  public cancel(
    @Param('id') id: string,
    @ZodBody(CancelMatchBodySchema) body: CancelMatchBody,
  ): Promise<Match> {
    return this.matches.cancel(id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Search public matches with combinable filters, stable cursor pagination, and sorting' })
  @ApiQuery({ name: 'city', required: false, description: 'City slug' })
  @ApiQuery({ name: 'stadium', required: false, description: 'Stadium slug or id (matches held at this stadium)' })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Inclusive UTC ISO-8601 instant' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'Exclusive UTC ISO-8601 instant' })
  @ApiQuery({ name: 'date', required: false, enum: ['today', 'tomorrow', 'week'] })
  @ApiQuery({ name: 'format', required: false, isArray: true, enum: ['F5', 'F6', 'F7', 'F8', 'F9', 'F11'] })
  @ApiQuery({ name: 'level', required: false, isArray: true })
  @ApiQuery({ name: 'surface', required: false, isArray: true })
  @ApiQuery({ name: 'minFreeSlots', required: false, type: Number })
  @ApiQuery({ name: 'onlyAvailable', required: false, type: Boolean })
  @ApiQuery({ name: 'favoritesOnly', required: false, type: Boolean, description: 'Restrict to matches by favourited organizers or at favourited stadiums (requires authentication)' })
  @ApiQuery({ name: 'joinMode', required: false, enum: ['AUTO', 'MANUAL', 'INVITE_ONLY'] })
  @ApiQuery({ name: 'priceMin', required: false, type: Number })
  @ApiQuery({ name: 'priceMax', required: false, type: Number })
  @ApiQuery({ name: 'startHourFrom', required: false, type: Number, description: 'Asia/Tashkent wall-clock hour (0–23)' })
  @ApiQuery({ name: 'startHourTo', required: false, type: Number, description: 'Asia/Tashkent wall-clock hour (0–23)' })
  @ApiQuery({ name: 'position', required: false, enum: ['GK', 'DEF', 'MID', 'FWD', 'UNIVERSAL'] })
  @ApiQuery({ name: 'nearLat', required: false, type: Number })
  @ApiQuery({ name: 'nearLng', required: false, type: Number })
  @ApiQuery({ name: 'radiusKm', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, description: 'Unaccented full-text and typo-tolerant search' })
  @ApiQuery({ name: 'sort', required: false, enum: ['soonest', 'nearest', 'newest', 'mostFreeSlots', 'organizerTrust', 'priceAsc', 'priceDesc'] })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchesResponse' } })
  @UseGuards(OptionalAuthGuard)
  public list(
    @Query(new ZodValidationPipe(MatchesQuerySchema)) query: MatchSearchQuery,
    @CurrentUserParam() user: CurrentUser | undefined,
  ): Promise<MatchesResponse> {
    return this.matches.list(query, user?.id);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a public match by slug' })
  @ApiParam({ name: 'slug' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MatchDetail' } })
  @ApiNotFoundResponse({ description: 'Public match not found' })
  @ApiResponse({ status: HttpStatus.GONE, description: 'Finished match retention period has elapsed' })
  @ApiQuery({ name: 'locale', required: false })
  public bySlug(@Param('slug') slug: string, @Query('locale') locale?: string): Promise<MatchDetail> {
    return this.matches.bySlug(slug, locale);
  }
}
