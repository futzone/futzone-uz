import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { PushController } from './push.controller';
import { NotificationsService } from './notifications.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationWorkerService } from './notification-worker.service';
import { SseAuthGuard } from './sse-auth.guard';
import { WebPushService } from './web-push.service';

// Global: notify() is a cross-cutting concern used by matches, attendance, ratings and (later)
// admin, so consumers get NotificationsService without importing this module or risking cycles.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController, PushController],
  providers: [
    NotificationsService,
    NotificationQueueService,
    NotificationDeliveryService,
    NotificationStreamService,
    NotificationWorkerService,
    SseAuthGuard,
    WebPushService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
