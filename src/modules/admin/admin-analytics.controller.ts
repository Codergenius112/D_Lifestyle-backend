import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsQueryDto } from '../../shared/dtos/admin.dto';
import { UserRole } from '../../shared/enums';

@ApiTags('Admin - Analytics & Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get analytics dashboard' })
  async getDashboard() {
    return {
      totalBookings: 0,
      totalRevenue: 0,
      platformCommission: 0,
      avgOrderValue: 0,
    };
  }

  @Get('bookings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get booking analytics' })
  async getBookingAnalytics(@Query() query: AnalyticsQueryDto) {
    return { message: 'Booking analytics' };
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get revenue analytics' })
  async getRevenueAnalytics(@Query() query: AnalyticsQueryDto) {
    return { message: 'Revenue analytics' };
  }

  @Get('staff-performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get staff performance metrics' })
  async getStaffPerformance(@Query() query: AnalyticsQueryDto) {
    return { message: 'Staff performance' };
  }

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get order analytics' })
  async getOrderAnalytics(@Query() query: AnalyticsQueryDto) {
    return { message: 'Order analytics' };
  }
}
