import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessIds, ActiveBusinessId, BusinessScopes, ActiveBusinessScopes } from '../../common/decorators/business-context.decorator'; // ← CHANGED (scope fix)
import { VenueService, CreateVenueDto, UpdateVenueDto } from './venue.service';
import { UserRole, BusinessScope } from '../../shared/enums';
import { hasBusinessScope, effectiveOwnerId } from '../../shared/utils/business-scope.util';

// Venues can host both table/club business and ticketed events, so general
// venue visibility/management requires either scope. Floor plans are strictly
// a table/club feature and require TABLE_CLUB specifically (checked below).
// ← CHANGED (multi-tenancy): on top of the category check, every staff-facing
// method now scopes by businessId (via TenantScopeGuard) rather than
// effectiveOwnerId, so an owner with more than one business gets each one
// isolated from the others, not just isolated from other owners.
// ← CHANGED (scope fix): the category check itself now reads the resolved
// BUSINESS's own scopes (Business.businessScopes, via TenantScopeGuard),
// not the legacy per-User businessScopes field — a business with both
// TABLE_CLUB and EVENT_TICKETING now genuinely lets the same staff manage
// both, with zero extra wiring, since it's read fresh from the business
// itself rather than a static field set once when the staff was hired.
const VENUE_SCOPES = [BusinessScope.TABLE_CLUB, BusinessScope.EVENT_TICKETING];

@ApiTags('Venues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a venue, owned by the calling business owner' })
  create(
    @Body() dto: CreateVenueDto, @CurrentUser() user: any,
    @ActiveBusinessId() activeBusinessId?: string | null,
    @ActiveBusinessScopes() activeBusinessScopes?: BusinessScope[],
  ) {
    if (!activeBusinessId) {
      throw new BadRequestException(
        'Could not determine which business this venue belongs to. If you manage more than one business, specify one via the X-Business-Id header.',
      );
    }
    if (!hasBusinessScope({ role: user.role, businessScopes: activeBusinessScopes }, VENUE_SCOPES)) {
      throw new ForbiddenException('This business is not set up for venues — ask a super admin to add the scope.');
    }
    return this.venueService.create(dto, effectiveOwnerId(user) as string, activeBusinessId);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List venues — customers see active venues only; staff see their own business(es) only, unless super admin' })
  findAll(
    @CurrentUser() user: any,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
    @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    if (isStaff && !hasBusinessScope({ role: user.role, businessScopes }, VENUE_SCOPES)) {
      return { data: [], total: 0 };
    }
    return this.venueService.findAll({
      city,
      category,
      limit: limit ? +limit : 50,
      offset: offset ? +offset : 0,
      activeOnly: !isStaff,
      businessIds: isStaff ? businessIds : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single venue by id' })
  findOne(
    @Param('id') id: string, @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[], @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    if (isStaff && !hasBusinessScope({ role: user.role, businessScopes }, VENUE_SCOPES)) {
      throw new ForbiddenException('You are not assigned to a business that manages venues.');
    }
    return this.venueService.findOne(id, isStaff ? businessIds : undefined);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a venue, within one of the caller\'s own business(es)' })
  update(
    @Param('id') id: string, @Body() dto: UpdateVenueDto, @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[], @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes }, VENUE_SCOPES)) {
      throw new ForbiddenException('You are not assigned to a business that manages venues.');
    }
    return this.venueService.update(id, dto, businessIds);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a venue, within one of the caller\'s own business(es)' })
  remove(
    @Param('id') id: string, @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[], @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes }, VENUE_SCOPES)) {
      throw new ForbiddenException('You are not assigned to a business that manages venues.');
    }
    return this.venueService.softDelete(id, businessIds);
  }

  @Post(':id/floor-plan')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Update venue floor plan — requires TABLE_CLUB business scope, and the venue must belong to one of the caller\'s own business(es)' })
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
    @BusinessIds() businessIds?: string[],
    @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes }, BusinessScope.TABLE_CLUB)) {
      throw new ForbiddenException('Floor plans are a table/club business feature.');
    }
    return this.venueService.updateFloorPlan(id, floorPlanData, undefined, businessIds);
  }
}
