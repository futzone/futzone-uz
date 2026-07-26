import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { StatsModule } from '../stats/stats.module';

@Module({
  imports: [AuthModule, MatchesModule, StatsModule],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
