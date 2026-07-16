import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VenueService, CreateVenueDto, UpdateVenueDto } from './venue.service';
import { UserRole } from '../../shared/enums';

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
    return this.venueService.create(dto, user.id);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List venues — customers see active venues only; staff see everything non-deleted' })
  findAll(
    @CurrentUser() user: any,
    @Query('city') city?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.venueService.findAll({
      city,
      limit: limit ? +limit : 50,
      offset: offset ? +offset : 0,
      activeOnly: !isStaff,
    });
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single venue by id' })
  findOne(@Param('id') id: string) {
    return this.venueService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a venue' })
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venueService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a venue' })
  remove(@Param('id') id: string) {
    return this.venueService.softDelete(id);
  }

  @Post(':id/floor-plan')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Update venue floor plan' })
  async updateFloorPlan(
    @Param('id') id: string,
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
    return this.venueService.updateFloorPlan(id, floorPlanData);
  }
}