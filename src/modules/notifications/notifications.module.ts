import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DeviceToken } from '../../shared/entities/device-token.entity';
import { Notification } from '../../shared/entities/notification.entity';
import { NotificationService }   from './notifications.service';
import { NotificationProcessor } from './notification.processor';
import { NotificationsController } from './notifications.controller';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy — notifications gap fix)

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceToken, Notification]),
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  providers:   [NotificationService, NotificationProcessor, BusinessContextService], // ← CHANGED (multi-tenancy — notifications gap fix)
  controllers: [NotificationsController],
  exports:     [NotificationService],
})
export class NotificationsModule {}