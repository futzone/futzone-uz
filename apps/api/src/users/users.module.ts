import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvatarController } from './avatar/avatar.controller';
import { AvatarProcessorService } from './avatar/avatar-processor.service';
import { AvatarQueueService } from './avatar/avatar-queue.service';
import { AvatarService } from './avatar/avatar.service';
import { AvatarStorageService } from './avatar/avatar-storage.service';
import { AvatarWorkerService } from './avatar/avatar-worker.service';
import { AvatarOwnershipPolicy } from './avatar/avatar-ownership.policy';
import { CitiesController, MeController, UsersController } from './users.controller';
import { UsernameChangePolicy } from './username-change.policy';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule], controllers: [UsersController, MeController, CitiesController, AvatarController],
  providers: [UsersService, UsernameChangePolicy, AvatarService, AvatarStorageService, AvatarQueueService, AvatarProcessorService, AvatarWorkerService, AvatarOwnershipPolicy],
})
export class UsersModule {}
