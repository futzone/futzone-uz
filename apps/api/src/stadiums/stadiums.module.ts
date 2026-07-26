import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { StadiumsController } from './stadiums.controller';
import { StadiumsService } from './stadiums.service';

@Module({ imports: [AuthModule], controllers: [StadiumsController], providers: [StadiumsService, AdminGuard] })
export class StadiumsModule {}
