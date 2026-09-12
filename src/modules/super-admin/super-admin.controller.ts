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
import { BusinessScope, CommissionPayer, BusinessStatus }           from '../../shared/enums';
import { IsArray, IsEnum, IsOptional, IsNumber, IsString, IsBoolean, Min, Max } from 'class-validator';

class UpdateScopesDto {
  @IsArray() @IsEnum(BusinessScope, { each: true })
  scopes: BusinessScope[];
}

class UpdateBusinessStatusDto {
  @IsEnum(BusinessStatus) status: BusinessStatus;
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

  // ← NEW (scope fix) — updates Business.businessScopes, the actual
  // enforcement-level source of truth (see hasBusinessScope call sites),
  // as distinct from updateUserScopes above, which only ever touched a
  // legacy per-User field. Use this to let an existing business take on a
  // new capability, e.g. adding EVENT_TICKETING to a business that started
  // out as TABLE_CLUB-only — no need to create a whole second business.
  @Patch('businesses/:id/scopes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Assign/update business scopes for a business (the real source of truth for what it can create/manage)' })
  updateBusinessScopes(
    @Param('id') businessId: string,
    @Body() dto: UpdateScopesDto,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.superAdminService.updateBusinessScopes(businessId, dto.scopes, user.id, ip);
  }

  // ← NEW (Business approval/suspension UI) — list every business on the
  // platform, optionally filtered by status, for the super admin dashboard.
  @Get('businesses')
  @ApiOperation({ summary: 'List all businesses on the platform, optionally filtered by status' })
  listBusinesses(
    @Query('status') status?: BusinessStatus,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('search') search?: string,
  ) {
    return this.superAdminService.listBusinesses({ status, limit: +limit, offset: +offset, search });
  }

  @Get('businesses/:id')
  @ApiOperation({ summary: 'Get a single business by id' })
  getBusiness(@Param('id') businessId: string) {
    return this.superAdminService.getBusiness(businessId);
  }

  // Covers approve (PENDING → APPROVED), reject (PENDING → REJECTED),
  // suspend (APPROVED → SUSPENDED), and reinstate (SUSPENDED → APPROVED) —
  // all the same underlying operation, just a different target status.
  // Suspension takes effect immediately: see
  // BusinessContextService.assertBusinessActive, already wired into every
  // relevant write path (bookings, orders, venues, cars, apartments,
  // events, inventory).
  @Patch('businesses/:id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve, reject, suspend, or reinstate a business' })
  updateBusinessStatus(
    @Param('id') businessId: string,
    @Body() dto: UpdateBusinessStatusDto,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.superAdminService.updateBusinessStatus(businessId, dto.status, user.id, ip);
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