import { Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { FavoriteMutationResponse, FavoritesResponse } from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me/favorites')
export class FavoritesController {
  public constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's favourite stadiums and organizers" })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/FavoritesResponse' } })
  public list(@CurrentUserParam() user: CurrentUser): Promise<FavoritesResponse> {
    return this.favorites.list(user.id);
  }

  @Put('stadiums/:stadiumId')
  @ApiOperation({ summary: 'Favourite a stadium (idempotent)' })
  @ApiParam({ name: 'stadiumId' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/FavoriteMutationResponse' } })
  public addStadium(@CurrentUserParam() user: CurrentUser, @Param('stadiumId') stadiumId: string): Promise<FavoriteMutationResponse> {
    return this.favorites.addStadium(user.id, stadiumId);
  }

  @Delete('stadiums/:stadiumId')
  @ApiOperation({ summary: 'Remove a favourite stadium (idempotent)' })
  @ApiParam({ name: 'stadiumId' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/FavoriteMutationResponse' } })
  public removeStadium(@CurrentUserParam() user: CurrentUser, @Param('stadiumId') stadiumId: string): Promise<FavoriteMutationResponse> {
    return this.favorites.removeStadium(user.id, stadiumId);
  }

  @Put('organizers/:organizerId')
  @ApiOperation({ summary: 'Favourite an organizer (idempotent)' })
  @ApiParam({ name: 'organizerId' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/FavoriteMutationResponse' } })
  public addOrganizer(@CurrentUserParam() user: CurrentUser, @Param('organizerId') organizerId: string): Promise<FavoriteMutationResponse> {
    return this.favorites.addOrganizer(user.id, organizerId);
  }

  @Delete('organizers/:organizerId')
  @ApiOperation({ summary: 'Remove a favourite organizer (idempotent)' })
  @ApiParam({ name: 'organizerId' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/FavoriteMutationResponse' } })
  public removeOrganizer(@CurrentUserParam() user: CurrentUser, @Param('organizerId') organizerId: string): Promise<FavoriteMutationResponse> {
    return this.favorites.removeOrganizer(user.id, organizerId);
  }
}
