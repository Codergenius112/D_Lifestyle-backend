import {
  Controller, Get, Patch, Body,
  Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }            from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard }         from '../../common/guards/super-admin.guard';
import { CurrentUser }             from '../../common/decorators/current-user.decorator';
import { IpAddress }               from '../../common/decorators/ip-address.decorator';
import { SuperAdminService }       from './super-admin.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { BusinessScope }           from '../../shared/enums';
import { IsArray, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

class UpdateScopesDto {
  @IsArray() @IsEnum(BusinessScope, { each: true })
  scopes: BusinessScope[];
}

class UpdatePlatformSettingsDto {
  @IsOptional() @IsNumber() @Min(0) serviceCharge?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) commissionRate?: number;
  @IsOptional() @IsNumber() @Min(0) pushNotificationFee?: number;
}

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private superAdminService: SuperAdminService,
    private platformSettingsService: PlatformSettingsService,
  ) {}

  // ─── Platform Settings ────────────────────────────────────────────────────
  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  getSettings() {
    return this.platformSettingsService.getSettings();
  }

  @Patch('settings')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update platform settings (unified)' })
  updateSettings(
    @Body() dto: UpdatePlatformSettingsDto,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.platformSettingsService.updateSettings(dto, user.id, ip);
  }

  // ─── Users ────────────────────────────────────────────────────────────────
  @Get('users')
  @ApiOperation({ summary: 'List all platform users (paginated)' })
  listUsers(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    return this.superAdminService.listAllUsers({
      limit: +limit, offset: +offset, role: role as any, search,
    });
  }

  @Patch('users/:id/scopes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Assign/update business scopes for a user' })
  updateUserScopes(
    @Param('id') userId: string,
    @Body() dto: UpdateScopesDto,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.superAdminService.updateUserScopes(userId, dto.scopes, user.id, ip);
  }

  @Patch('users/:id/promote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Promote a user to ADMIN role' })
  promoteToAdmin(
    @Param('id') userId: string,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.superAdminService.promoteToAdmin(userId, user.id, ip);
  }

  @Patch('users/:id/demote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Demote an admin to CUSTOMER' })
  demoteAdmin(
    @Param('id') userId: string,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.superAdminService.demoteAdmin(userId, user.id, ip);
  }

  // ─── Financials & Audit ───────────────────────────────────────────────────
  @Get('financials')
  @ApiOperation({ summary: 'Get platform financial aggregates' })
  getFinancials(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.superAdminService.getPlatformFinancials(
      startDate ? new Date(startDate) : undefined,
      endDate   ? new Date(endDate)   : undefined,
    );
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  getAuditLogs(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.superAdminService.getAuditLogs({
      limit: +limit, offset: +offset, action, resourceType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate:   endDate   ? new Date(endDate)   : undefined,
    });
  }
}