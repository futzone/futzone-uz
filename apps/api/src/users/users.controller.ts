import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CitiesQuerySchema, PublicProfileQuerySchema, UpdateMeBodySchema, UpdateUsernameBodySchema, UsernameSchema, type City, type Locale, type MeProfile, type MeSettings, type PublicProfile, type UpdateMeBody, type UpdateUsernameBody } from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  public constructor(private readonly users: UsersService) {}
  @Get(':username')
  @ApiOperation({ summary: 'Get a public player profile' })
  @ApiParam({ name: 'username', schema: { type: 'string', pattern: '^[a-z0-9_]{3,20}$' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/PublicProfile' } })
  @ApiNotFoundResponse({ description: 'User does not exist, is deleted, or is banned' })
  public profile(
    @Param('username', new ZodValidationPipe(UsernameSchema)) username: string,
    @Query(new ZodValidationPipe(PublicProfileQuerySchema)) query: { locale: Locale; commentsPage: number },
  ): Promise<PublicProfile> { return this.users.publicProfile(username, query.locale, query.commentsPage); }
}

@ApiTags('profile')
@Controller('me')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MeController {
  public constructor(private readonly users: UsersService) {}
  @Patch()
  @ApiOperation({ summary: 'Update the authenticated profile' })
  @ApiBody({ schema: { $ref: '#/components/schemas/UpdateMeBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MeProfile' } })
  @ApiBadRequestResponse({ description: 'Invalid profile fields' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  public update(@CurrentUserParam() user: CurrentUser, @ZodBody(UpdateMeBodySchema) body: UpdateMeBody): Promise<MeProfile> { return this.users.updateMe(user.id, body); }

  @Patch('username')
  @ApiOperation({ summary: 'Change the authenticated username' })
  @ApiBody({ schema: { $ref: '#/components/schemas/UpdateUsernameBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MeProfile' } })
  @ApiConflictResponse({ description: 'Username is taken' })
  @ApiTooManyRequestsResponse({ description: 'Username changed within the last 30 days' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  public username(@CurrentUserParam() user: CurrentUser, @ZodBody(UpdateUsernameBodySchema) body: UpdateUsernameBody): Promise<MeProfile> { return this.users.changeUsername(user.id, body.username); }

  @Get('settings')
  @ApiOperation({ summary: 'Get private settings for the authenticated user' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/MeSettings' } })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  public settings(@CurrentUserParam() user: CurrentUser): Promise<MeSettings> { return this.users.settings(user.id); }
}

@ApiTags('cities')
@Controller('cities')
export class CitiesController {
  public constructor(private readonly users: UsersService) {}
  @Get()
  @ApiOperation({ summary: 'List active cities with localized names' })
  @ApiQuery({ name: 'locale', required: false, enum: ['uz', 'uz-Cyrl', 'ru', 'en'] })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/CitiesResponse' } })
  @ApiBadRequestResponse({ description: 'Unsupported locale' })
  public list(@Query(new ZodValidationPipe(CitiesQuerySchema)) query: { locale: Locale }): Promise<City[]> { return this.users.cities(query.locale); }
}
