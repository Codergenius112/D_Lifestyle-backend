import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DeviceToken } from '../../shared/entities/device-token.entity';
import { NotificationService }   from './notifications.service';
import { NotificationProcessor } from './notification.processor';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceToken]),
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  providers:   [NotificationService, NotificationProcessor],
  controllers: [NotificationsController],
  exports:     [NotificationService],
})
export class NotificationsModule {}