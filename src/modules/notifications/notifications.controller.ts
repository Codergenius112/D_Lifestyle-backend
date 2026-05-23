import { Controller, Get, Post, Delete, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { NotificationService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationService: NotificationService) {}

  /**
   * POST /notifications/register-token
   * Called by the app on launch (after auth) to register the device's
   * Expo push token. Idempotent — safe to call every time.
   *
   * Body: { token: string, platform?: 'expo' | 'fcm' | 'apns' }
   */
  @Post('register-token')
  @HttpCode(200)
  async registerToken(
    @Body() body: { token: string; platform?: 'expo' | 'fcm' | 'apns' },
    @CurrentUser() user: any,
  ) {
    if (!body.token) {
      return { success: false, message: 'Token is required' };
    }

    await this.notificationService.registerToken(
      user.id,
      body.token,
      body.platform || 'expo',
    );

    return { success: true, message: 'Device token registered' };
  }

  /**
   * DELETE /notifications/remove-token
   * Called on logout to stop notifications on this device.
   *
   * Body: { token: string }
   */
  @Delete('remove-token')
  @HttpCode(200)
  async removeToken(
    @Body() body: { token: string },
    @CurrentUser() user: any,
  ) {
    if (!body.token) {
      return { success: false, message: 'Token is required' };
    }

    await this.notificationService.removeToken(user.id, body.token);
    return { success: true, message: 'Device token removed' };
  }

  /**
   * POST /notifications/send
   * Admin-only: manually send a push to a specific user.
   */
  @Post('send')
  @HttpCode(201)
  async sendNotification(
    @Body() body: { userId: string; title: string; message: string },
  ) {
    await this.notificationService.sendNotification(
      body.userId,
      body.title,
      body.message,
    );
    return { success: true, message: 'Notification queued' };
  }

  /**
   * POST /notifications/send-bulk
   * Admin-only: send to multiple users at once.
   */
  @Post('send-bulk')
  @HttpCode(201)
  async sendBulkNotification(
    @Body() body: { userIds: string[]; title: string; message: string },
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

  /**
   * POST /notifications/schedule
   * Admin-only: schedule a notification for a future time.
   */
  @Post('schedule')
  @HttpCode(201)
  async scheduleNotification(
    @Body() body: { userId: string; title: string; message: string; delaySeconds: number },
  ) {
    await this.notificationService.scheduleNotification(
      body.userId,
      body.title,
      body.message,
      body.delaySeconds,
    );
    return {
      success: true,
      message: `Notification scheduled for ${body.delaySeconds}s`,
    };
  }

  @Get('health')
  async healthCheck() {
    return { status: 'ok', service: 'notifications' };
  }
}