import {
  Controller, Get, Patch, Post, Body,
  Param, Query, UseGuards, HttpCode, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }            from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard }         from '../../common/guards/super-admin.guard';
import { CurrentUser }             from '../../common/decorators/current-user.decorator';
import { IpAddress }               from '../../common/decorators/ip-address.decorator';
import { SuperAdminService }       from './super-admin.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AdminService } from '../admin/admin.service';
import { InjectRepository }        from '@nestjs/typeorm';
import { Repository }              from 'typeorm';
import { CampaignTier }            from '../../shared/entities/campaign-tier.entity';
import { BusinessScope, CommissionPayer }           from '../../shared/enums';
import { IsArray, IsEnum, IsOptional, IsNumber, IsString, IsBoolean, Min, Max } from 'class-validator';

class UpdateScopesDto {
  @IsArray() @IsEnum(BusinessScope, { each: true })
  scopes: BusinessScope[];
}

class OnboardBusinessOwnerDto {
  @IsString() email: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() password?: string;
  @IsArray() @IsEnum(BusinessScope, { each: true }) businessScopes: BusinessScope[];
}

class CreateCampaignTierDto {
  @IsString() label: string;
  @IsNumber() @Min(1) maxRecipients: number;
  @IsNumber() @Min(0) price: number;
}

class UpdateCampaignTierDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsNumber() @Min(1) maxRecipients?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private superAdminService: SuperAdminService,
    private platformSettingsService: PlatformSettingsService,
    private adminService: AdminService,
    @InjectRepository(CampaignTier)
    private readonly campaignTierRepo: Repository<CampaignTier>,
  ) {}

  // ─── Business Owners ────────────────────────────────────────────────────────
  @Post('business-owners')
  @HttpCode(201)
  @ApiOperation({ summary: 'Onboard a new business owner (Admin role) with one or more business scopes' })
  onboardBusinessOwner(
    @Body() dto: OnboardBusinessOwnerDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.adminService.onboardBusinessOwner(dto, user.id, ipAddress);
  }

  // Note: GET/PATCH platform settings live in PlatformSettingsController
  // (super-admin/settings) — not duplicated here to avoid two controllers
  // racing to own the same route (see AdminAnalyticsController removal).

  // ─── Notification Campaign Tiers (target count / pricing) ────────────────
  @Get('campaign-tiers')
  @ApiOperation({ summary: 'List all notification pricing tiers, including inactive ones' })
  listCampaignTiers() {
    return this.campaignTierRepo.find({ order: { maxRecipients: 'ASC' } });
  }

  @Get('campaign-tiers/:id')
  @ApiOperation({ summary: 'Get one notification pricing tier' })
  async getCampaignTier(@Param('id') id: string) {
    return this.campaignTierRepo.findOne({ where: { id } });
  }

  @Post('campaign-tiers')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new notification pricing tier (target count + price)' })
  createCampaignTier(@Body() dto: CreateCampaignTierDto) {
    const tier = this.campaignTierRepo.create({ ...dto, isActive: true });
    return this.campaignTierRepo.save(tier);
  }

  @Patch('campaign-tiers/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a notification pricing tier (target count, price, or active status)' })
  async updateCampaignTier(@Param('id') id: string, @Body() dto: UpdateCampaignTierDto) {
    const tier = await this.campaignTierRepo.findOne({ where: { id } });
    if (!tier) throw new NotFoundException('Tier not found');
    Object.assign(tier, dto);
    return this.campaignTierRepo.save(tier);
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