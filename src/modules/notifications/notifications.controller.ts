import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { NotificationService } from './notifications.service';
import { UserRole } from '../../shared/enums';

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
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
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
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
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

  // ─── User-facing: read your own notifications ───────────────────────────────

  /**
   * GET /notifications/my
   * The actual "Activity" feed the mobile app reads from.
   */
  @Get('my')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getMyNotifications(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationService.getUserNotifications(
      user.id,
      limit ? +limit : 30,
      offset ? +offset : 0,
    );
  }

  @Patch(':id/read')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Patch('read-all')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  async markAllAsRead(@CurrentUser() user: any) {
    await this.notificationService.markAllAsRead(user.id);
    return { success: true };
  }

  // ─── Admin-only: send pushes ─────────────────────────────────────────────────
  // These were missing @Roles entirely before — any authenticated customer
  // could call them and push arbitrary notifications to any userId.

  /**
   * POST /notifications/send
   * Admin-only: manually send a push to a specific user.
   */
  @Post('send')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  async sendNotification(
    @Body() body: { userId: string; title: string; message: string; type?: string; data?: Record<string, any> },
  ) {
    await this.notificationService.sendNotification(
      body.userId,
      body.title,
      body.message,
      body.data,
      body.type,
    );
    return { success: true, message: 'Notification sent' };
  }

  /**
   * POST /notifications/send-bulk
   * Admin-only: send to multiple users at once.
   */
  @Post('send-bulk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  async sendBulkNotification(
    @Body() body: { userIds: string[]; title: string; message: string; type?: string; data?: Record<string, any> },
  ) {
    await this.notificationService.sendBulkNotification(
      body.userIds,
      body.title,
      body.message,
      body.data,
      body.type,
    );
    return {
      success: true,
      message: `Bulk notification sent to ${body.userIds.length} users`,
    };
  }

  /**
   * POST /notifications/schedule
   * Admin-only: schedule a notification for a future time.
   */
  @Post('schedule')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  async scheduleNotification(
    @Body() body: { userId: string; title: string; message: string; delaySeconds: number; type?: string; data?: Record<string, any> },
  ) {
    await this.notificationService.scheduleNotification(
      body.userId,
      body.title,
      body.message,
      body.delaySeconds,
      body.data,
      body.type,
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
