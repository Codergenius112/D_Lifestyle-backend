import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy — notifications gap fix)
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { BusinessIds }  from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy — notifications gap fix)
import { NotificationService } from './notifications.service';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy — notifications gap fix)
import { UserRole } from '../../shared/enums';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy — notifications gap fix)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationService: NotificationService,
    private readonly businessContext: BusinessContextService, // ← NEW (multi-tenancy — notifications gap fix)
  ) {}

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
   * ← CHANGED (multi-tenancy — notifications gap fix): previously any
   * admin/manager could message ANY userId on the platform. Now requires
   * the target to actually have a booking under one of the caller's
   * businesses — super admin is exempt (can message anyone, matching
   * their platform-wide oversight role elsewhere).
   */
  @Post('send')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  async sendNotification(
    @Body() body: { userId: string; title: string; message: string; type?: string; data?: Record<string, any> },
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    if (businessIds !== undefined) {
      const isCustomer = await this.businessContext.isCustomerOfAnyBusiness(body.userId, businessIds);
      if (!isCustomer) {
        throw new ForbiddenException('This user has no booking history with your business — you can only message your own customers.');
      }
    }
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
   * ← CHANGED (multi-tenancy — notifications gap fix): silently filters
   * the recipient list down to only users with a booking under one of the
   * caller's businesses, rather than rejecting the whole batch — reports
   * how many were actually messaged vs. requested.
   */
  @Post('send-bulk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  async sendBulkNotification(
    @Body() body: { userIds: string[]; title: string; message: string; type?: string; data?: Record<string, any> },
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    const targetUserIds = businessIds !== undefined
      ? await this.businessContext.filterCustomersOfAnyBusiness(body.userIds, businessIds)
      : body.userIds;

    await this.notificationService.sendBulkNotification(
      targetUserIds,
      body.title,
      body.message,
      body.data,
      body.type,
    );
    return {
      success: true,
      message: `Bulk notification sent to ${targetUserIds.length} of ${body.userIds.length} requested users`,
      skipped: body.userIds.length - targetUserIds.length,
    };
  }

  /**
   * POST /notifications/schedule
   * Admin-only: schedule a notification for a future time.
   * ← CHANGED (multi-tenancy — notifications gap fix): same customer-
   * relationship check as /send.
   */
  @Post('schedule')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  async scheduleNotification(
    @Body() body: { userId: string; title: string; message: string; delaySeconds: number; type?: string; data?: Record<string, any> },
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    if (businessIds !== undefined) {
      const isCustomer = await this.businessContext.isCustomerOfAnyBusiness(body.userId, businessIds);
      if (!isCustomer) {
        throw new ForbiddenException('This user has no booking history with your business — you can only message your own customers.');
      }
    }
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
