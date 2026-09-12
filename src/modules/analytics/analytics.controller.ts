import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessIds } from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy)
import { AnalyticsService } from './analytics.service';
import { UserRole } from '../../shared/enums';
import { bookingTypesForUser } from '../../shared/utils/business-scope.util';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard) // ← CHANGED (multi-tenancy)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getDashboard(@CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.analyticsService.getDashboardMetrics(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
      bookingTypesForUser(user),
      businessIds,
    );
  }

  @Get('bookings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getBookingAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    return this.analyticsService.getBookingAnalytics(
      new Date(startDate), new Date(endDate), bookingTypesForUser(user), businessIds,
    );
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getRevenueAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    return this.analyticsService.getRevenueAnalytics(
      new Date(startDate), new Date(endDate), bookingTypesForUser(user), businessIds,
    );
  }

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getOrderAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    return this.analyticsService.getOrderAnalytics(
      new Date(startDate), new Date(endDate), bookingTypesForUser(user), businessIds,
    );
  }

  @Get('staff-performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getStaffPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    return this.analyticsService.getStaffPerformance(
      new Date(startDate), new Date(endDate), bookingTypesForUser(user), businessIds,
    );
  }
}
