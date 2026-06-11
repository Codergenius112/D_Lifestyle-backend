import {
  Controller, Get, Post, Body, Param,
  UseGuards, HttpCode, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';
import { IpAddress }     from '../../common/decorators/ip-address.decorator';
import { CampaignService, CreateCampaignDto } from './campaign.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a notification campaign draft' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: any) {
    return this.campaignService.create(dto, user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all campaigns' })
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.campaignService.list({
      limit: limit ? +limit : 50,
      offset: offset ? +offset : 0,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get campaign by ID' })
  findOne(@Param('id') id: string) {
    return this.campaignService.findOne(id);
  }

  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a campaign (charges platform fee to admin wallet)' })
  send(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.campaignService.send(id, user.id, ipAddress);
  }
}