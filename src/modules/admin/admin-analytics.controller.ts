import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { AnalyticsService } from '../analytics/analytics.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Admin - Analytics & Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private parseDateRange(query: { startDate?: string; endDate?: string }) {
    const end   = query.endDate   ? new Date(query.endDate)   : new Date();
    const start = query.startDate ? new Date(query.startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  getDashboard(@Query() query: { startDate?: string; endDate?: string }) {
    const { start, end } = this.parseDateRange(query);
    return this.analyticsService.getDashboardMetrics(start, end);
  }

  @Get('bookings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  getBookingAnalytics(@Query() query: { startDate?: string; endDate?: string }) {
    const { start, end } = this.parseDateRange(query);
    return this.analyticsService.getBookingAnalytics(start, end);
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  getRevenueAnalytics(@Query() query: { startDate?: string; endDate?: string }) {
    const { start, end } = this.parseDateRange(query);
    return this.analyticsService.getRevenueAnalytics(start, end);
  }

  @Get('staff-performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  getStaffPerformance(@Query() query: { startDate?: string; endDate?: string }) {
    const { start, end } = this.parseDateRange(query);
    return this.analyticsService.getStaffPerformance(start, end);
  }

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  getOrderAnalytics(@Query() query: { startDate?: string; endDate?: string }) {
    const { start, end } = this.parseDateRange(query);
    return this.analyticsService.getOrderAnalytics(start, end);
  }
}