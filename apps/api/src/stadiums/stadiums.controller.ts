import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateStadiumBodySchema, StadiumModerationBodySchema, StadiumsQuerySchema, type CreateStadiumBody, type Stadium, type StadiumModerationBody } from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { StadiumsService } from './stadiums.service';

@ApiTags('stadiums')
@Controller('stadiums')
export class StadiumsController {
  public constructor(private readonly stadiums: StadiumsService) {}
  @Get()
  @ApiOperation({ summary: 'List approved stadiums' })
  @ApiQuery({ name: 'city', required: false, description: 'City slug or UUID' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/StadiumsResponse' } })
  public list(@Query(new ZodValidationPipe(StadiumsQuerySchema)) query: { city?: string }): Promise<Stadium[]> { return this.stadiums.list(query.city); }

  @Get(':slug')
  @ApiOperation({ summary: 'Get an approved stadium by slug' })
  @ApiParam({ name: 'slug' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/Stadium' } })
  @ApiNotFoundResponse({ description: 'Approved stadium not found' })
  public bySlug(@Param('slug') slug: string): Promise<Stadium> { return this.stadiums.bySlug(slug); }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a stadium for moderation' })
  @ApiBody({ schema: { $ref: '#/components/schemas/CreateStadiumBody' } })
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/Stadium' } })
  @ApiBadRequestResponse({ description: 'Invalid stadium data' })
  public create(@CurrentUserParam() user: CurrentUser, @ZodBody(CreateStadiumBodySchema) body: CreateStadiumBody): Promise<Stadium> { return this.stadiums.create(user.id, body); }

  @Patch(':id/status')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a stadium submission' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: { $ref: '#/components/schemas/StadiumModerationBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/Stadium' } })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  public moderate(@CurrentUserParam() user: CurrentUser, @Param('id') id: string, @ZodBody(StadiumModerationBodySchema) body: StadiumModerationBody): Promise<Stadium> { return this.stadiums.moderate(user.id, id, body); }
}
