import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VenueService, CreateVenueDto, UpdateVenueDto } from './venue.service';
import { UserRole, BusinessScope } from '../../shared/enums';
import { hasBusinessScope } from '../../shared/utils/business-scope.util';

// Venues can host both table/club business and ticketed events, so general
// venue visibility/management requires either scope. Floor plans are strictly
// a table/club feature and require TABLE_CLUB specifically (checked below).
const VENUE_SCOPES = [BusinessScope.TABLE_CLUB, BusinessScope.EVENT_TICKETING];

@ApiTags('Venues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a venue' })
  create(@Body() dto: CreateVenueDto, @CurrentUser() user: any) {
    if (!hasBusinessScope(user, VENUE_SCOPES)) {
      throw new ForbiddenException('You are not assigned to a business that manages venues.');
    }
    return this.venueService.create(dto, user.id);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List venues — customers see active venues only; staff see everything non-deleted, scoped to their business' })
  findAll(
    @CurrentUser() user: any,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    if (isStaff && !hasBusinessScope(user, VENUE_SCOPES)) {
      return { data: [], total: 0 };
    }
    return this.venueService.findAll({
      city,
      category,
      limit: limit ? +limit : 50,
      offset: offset ? +offset : 0,
      activeOnly: !isStaff,
    });
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single venue by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    if (isStaff && !hasBusinessScope(user, VENUE_SCOPES)) {
      throw new NotFoundException('Venue not found');
    }
    return this.venueService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a venue' })
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto, @CurrentUser() user: any) {
    if (!hasBusinessScope(user, VENUE_SCOPES)) {
      throw new ForbiddenException('You are not assigned to a business that manages venues.');
    }
    return this.venueService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a venue' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (!hasBusinessScope(user, VENUE_SCOPES)) {
      throw new ForbiddenException('You are not assigned to a business that manages venues.');
    }
    return this.venueService.softDelete(id);
  }

  @Post(':id/floor-plan')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Update venue floor plan — requires TABLE_CLUB business scope' })
  async updateFloorPlan(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() floorPlanData: {
      hasFloorPlan: boolean;
      floorPlanData?: {
        width: number;
        height: number;
        backgroundImage?: string;
        tables: Array<{
          tableId: string;
          x: number;
          y: number;
          rotation: number;
          width: number;
          height: number;
        }>;
      };
    },
  ) {
    if (!hasBusinessScope(user, BusinessScope.TABLE_CLUB)) {
      throw new ForbiddenException('Floor plans are a table/club business feature.');
    }
    return this.venueService.updateFloorPlan(id, floorPlanData);
  }
}