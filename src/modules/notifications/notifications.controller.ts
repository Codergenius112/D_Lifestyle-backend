import { Controller, Get, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { NotificationService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationService: NotificationService) {}

  @Post('send')
  @HttpCode(201)
  async sendNotification(
    @Body() body: { userId: string; title: string; message: string },
    @CurrentUser() user: any,
  ) {
    await this.notificationService.sendNotification(
      body.userId,
      body.title,
      body.message,
    );

    return { success: true, message: 'Notification queued' };
  }

  @Post('send-bulk')
  @HttpCode(201)
  async sendBulkNotification(
    @Body()
    body: { userIds: string[]; title: string; message: string },
    @CurrentUser() user: any,
  ) {
    await this.notificationService.sendBulkNotification(
      body.userIds,
      body.title,
      body.message,
    );

    return {
      success: true,
      message: `Bulk notification queued for ${body.userIds.length} users`,
    };
  }

  @Post('schedule')
  @HttpCode(201)
  async scheduleNotification(
    @Body()
    body: {
      userId: string;
      title: string;
      message: string;
      delaySeconds: number;
    },
    @CurrentUser() user: any,
  ) {
    await this.notificationService.scheduleNotification(
      body.userId,
      body.title,
      body.message,
      body.delaySeconds,
    );

    return {
      success: true,
      message: `Notification scheduled for ${body.delaySeconds} seconds`,
    };
  }

  @Get('health')
  async healthCheck() {
    return { status: 'ok', service: 'notifications' };
  }
}
