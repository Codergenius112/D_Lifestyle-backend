import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getDashboard() {
    return this.analyticsService.getDashboardMetrics(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
    );
  }

  @Get('bookings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getBookingAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getBookingAnalytics(new Date(startDate), new Date(endDate));
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getRevenueAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getRevenueAnalytics(new Date(startDate), new Date(endDate));
  }

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getOrderAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getOrderAnalytics(new Date(startDate), new Date(endDate));
  }

  @Get('staff-performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStaffPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getStaffPerformance(new Date(startDate), new Date(endDate));
  }
}