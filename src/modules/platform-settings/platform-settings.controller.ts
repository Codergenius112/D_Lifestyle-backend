import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

class UpdatePlatformSettingsDto {
  @IsOptional() @IsNumber() @Min(0) serviceCharge?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) commissionRate?: number;
  @IsOptional() @IsNumber() @Min(0) pushNotificationFee?: number;
}

@ApiTags('Platform Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('super-admin/settings')
export class PlatformSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform settings (SUPER_ADMIN only)' })
  getSettings() {
    return this.service.getSettings();
  }

  @Patch()
  @ApiOperation({ summary: 'Update platform settings (SUPER_ADMIN only)' })
  updateSettings(
    @Body() dto: UpdatePlatformSettingsDto,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.service.updateSettings(dto, user.id, ip);
  }
}