import {
  Controller, Get, Post, Body, Param,
  UseGuards, HttpCode, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy — campaigns gap fix)
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';
import { IpAddress }     from '../../common/decorators/ip-address.decorator';
import { BusinessIds }   from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy — campaigns gap fix)
import { CampaignService, CreateCampaignDto } from './campaign.service';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy — campaigns gap fix)
import { UserRole } from '../../shared/enums';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy — campaigns gap fix)
@Controller('campaigns')
export class CampaignController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly businessContext: BusinessContextService, // ← NEW (multi-tenancy — campaigns gap fix)
  ) {}

  @Get('tiers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List active pricing tiers (choose one when creating a campaign)' })
  listTiers() {
    return this.campaignService.listTiers();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a notification campaign draft' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: any) {
    return this.campaignService.create(dto, user.id);
  }

  // ← CHANGED (multi-tenancy — campaigns gap fix): scoped to campaigns
  // created within the caller's own business (owner or their staff) —
  // previously any admin/manager saw every business's campaigns, drafts
  // included.
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List campaigns created within the caller's own business, unless super admin" })
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @BusinessIds() businessIds?: string[],
  ) {
    const actorIds = businessIds !== undefined
      ? await this.businessContext.getActorIdsForBusinesses(businessIds)
      : undefined;
    return this.campaignService.list({
      limit: limit ? +limit : 50,
      offset: offset ? +offset : 0,
      actorIds,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get campaign by ID' })
  async findOne(@Param('id') id: string, @BusinessIds() businessIds?: string[]) {
    const actorIds = businessIds !== undefined
      ? await this.businessContext.getActorIdsForBusinesses(businessIds)
      : undefined;
    return this.campaignService.findOne(id, actorIds);
  }

  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a campaign (charges platform fee to admin wallet) — only the creating business may send its own draft' })
  async send(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @BusinessIds() businessIds?: string[],
  ) {
    const actorIds = businessIds !== undefined
      ? await this.businessContext.getActorIdsForBusinesses(businessIds)
      : undefined;
    return this.campaignService.send(id, user.id, ipAddress, actorIds);
  }
}