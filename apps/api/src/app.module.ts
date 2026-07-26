import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { ConfigService } from './config/config.service';
import { HealthModule } from './health/health.module';
import { createLoggerConfig } from './logging/logger.config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.service';
import { UsersModule } from './users/users.module';
import { StadiumsModule } from './stadiums/stadiums.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MatchesModule } from './matches/matches.module';
import { AttendanceModule } from './attendance/attendance.module';
import { RatingsModule } from './ratings/ratings.module';
import { StatsModule } from './stats/stats.module';
import { SeoModule } from './seo/seo.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createLoggerConfig(config.get('LOG_LEVEL'), config.get('NODE_ENV') === 'production'),
    }),
    PrismaModule,
    RedisModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StadiumsModule,
    FavoritesModule,
    MatchesModule,
    AttendanceModule,
    RatingsModule,
    StatsModule,
    SeoModule,
    AdminModule,
  ],
})
export class AppModule {}
