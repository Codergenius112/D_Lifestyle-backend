import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard }      from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard }   from '../../common/guards/super-admin.guard';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { IpAddress }         from '../../common/decorators/ip-address.decorator';
import { SuperAdminService } from './super-admin.service';
import { BookingStatus, AuditActionType } from '../../shared/enums';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)  // Every route here requires SUPER_ADMIN
@Controller('super-admin')
export class SuperAdminController {
  constructor(private superAdminService: SuperAdminService) {}

  // ─── Platform Settings ────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get current platform settings (service charge, commission)' })
  getSettings() {
    return this.superAdminService.getPlatformSettings();
  }

  @Patch('settings/service-charge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update platform service charge (₦) — affects new bookings only' })
  async updateServiceCharge(
    @Body() body: { amount: number },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.superAdminService.updateServiceCharge(body.amount, user.id, ipAddress);
  }

  @Patch('settings/commission-rate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update platform commission rate (%) — affects new bookings only' })
  async updateCommissionRate(
    @Body() body: { rate: number },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.superAdminService.updateCommissionRate(body.rate, user.id, ipAddress);
  }

  // ─── User / Role Management ───────────────────────────────────────────────

  @Patch('users/:id/promote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Promote a user to ADMIN role' })
  async promoteToAdmin(
    @Param('id') userId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.superAdminService.promoteToAdmin(userId, user.id, ipAddress);
  }

  @Patch('users/:id/demote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Demote an ADMIN back to MANAGER' })
  async demoteAdmin(
    @Param('id') userId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.superAdminService.demoteAdmin(userId, user.id, ipAddress);
  }

  @Get('users/stats')
  @ApiOperation({ summary: 'Get platform-wide user statistics' })
  async getUserStats() {
    return this.superAdminService.getUserStats();
  }

  // ─── Booking Override ─────────────────────────────────────────────────────

  @Patch('bookings/:id/override')
  @HttpCode(200)
  @ApiOperation({ summary: 'Override any booking status (SUPER_ADMIN only)' })
  async overrideBooking(
    @Param('id') bookingId: string,
    @Body() body: { status: BookingStatus; reason: string },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.superAdminService.overrideBookingStatus(
      bookingId, body.status, body.reason, user.id, ipAddress,
    );
  }

  // ─── Financial Overview ───────────────────────────────────────────────────

  @Get('financials')
  @ApiOperation({ summary: 'Full platform financial overview' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate',   required: false, example: '2026-12-31' })
  async getFinancials(
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1)); // start of month
    const end   = endDate   ? new Date(endDate)   : new Date();
    return this.superAdminService.getFinancialOverview(start, end);
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  @Get('audit-logs')
  @ApiOperation({ summary: 'View all audit logs across the platform' })
  @ApiQuery({ name: 'limit',      required: false })
  @ApiQuery({ name: 'offset',     required: false })
  @ApiQuery({ name: 'actorId',    required: false })
  @ApiQuery({ name: 'actionType', required: false, enum: AuditActionType })
  async getAuditLogs(
    @Query('limit')      limit      = 100,
    @Query('offset')     offset     = 0,
    @Query('actorId')    actorId?:    string,
    @Query('actionType') actionType?: AuditActionType,
  ) {
    return this.superAdminService.getFullAuditLog(
      Number(limit), Number(offset), actorId, actionType,
    );
  }

  @Get('audit-logs/verify')
  @ApiOperation({ summary: 'Verify audit log chain integrity — detects tampering' })
  async verifyAuditIntegrity() {
    return this.superAdminService.verifyAuditIntegrity();
  }
}