import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateRatingBodySchema, ReportRatingBodySchema,
  type CreateRatingBody, type RatablePlayer, type Rating, type RatingReport, type ReportRatingBody,
} from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { MatchActionGuard } from '../matches/match-action.guard';
import { RequireMatchAction } from '../matches/match-action.decorator';
import { MATCH_ACTIONS } from '../matches/match-permissions.policy';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@Controller()
export class RatingsController {
  public constructor(private readonly ratings: RatingsService) {}

  @Get('matches/:id/ratable')
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.RATE_PARTICIPANT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List eligible teammates and whether the caller rated them' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/RatablePlayers' } })
  public ratable(@CurrentUserParam() user: CurrentUser, @Param('id') matchId: string): Promise<RatablePlayer[]> {
    return this.ratings.ratable(matchId, user.id);
  }

  @Post('matches/:id/ratings')
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.RATE_PARTICIPANT)
  @ApiBearerAuth()
  @ApiBody({ schema: { $ref: '#/components/schemas/CreateRatingBody' } })
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/Rating' } })
  @ApiConflictResponse({ description: 'Rating window closed or duplicate rating' })
  public create(@CurrentUserParam() user: CurrentUser, @Param('id') matchId: string, @ZodBody(CreateRatingBodySchema) body: CreateRatingBody): Promise<Rating> {
    return this.ratings.create(matchId, user.id, body);
  }

  @Delete('matches/:id/ratings/:ratingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.RATE_PARTICIPANT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Rating soft-deleted' })
  public async remove(@CurrentUserParam() user: CurrentUser, @Param('id') matchId: string, @Param('ratingId') ratingId: string): Promise<void> {
    await this.ratings.remove(matchId, ratingId, user.id);
  }

  @Post('ratings/:id/report')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiBody({ schema: { $ref: '#/components/schemas/ReportRatingBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/RatingReport' } })
  public report(@CurrentUserParam() user: CurrentUser, @Param('id') ratingId: string, @ZodBody(ReportRatingBodySchema) body: ReportRatingBody): Promise<RatingReport> {
    return this.ratings.report(ratingId, user.id, body.reason);
  }
}
