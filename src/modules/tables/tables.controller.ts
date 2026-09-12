import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy — tables gap fix)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { BusinessIds, ActiveBusinessId, BusinessScopes, ActiveBusinessScopes } from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy — tables gap fix)
import { TablesService } from './tables.service';
import { UserRole, BusinessScope } from '../../shared/enums';
import { hasBusinessScope } from '../../shared/utils/business-scope.util';

// ← CHANGED (multi-tenancy — tables gap fix): this whole controller was
// missed during the original migration — it still used the legacy
// per-User businessScopes field, and the listings-management endpoints
// had NO business ownership check at all. Brought in line with the same
// pattern used by venue/apartments/cars/events.
@ApiTags('Tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard)
@Controller('tables')
export class TablesController {
  constructor(private tablesService: TablesService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async bookTable(
    @Body() createTableBookingDto: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.tablesService.bookTable(user.id, createTableBookingDto, ipAddress);
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  async getMyBookings(@CurrentUser() user: any, @Body() query: any) {
    const [bookings, total] = await this.tablesService.getUserTableBookings(
      user.id,
      query.limit || 20,
      query.offset || 0,
    );
    return { bookings, total };
  }

  // ── Admin: Table Listings Management ─────────────────────────────────────
  // IMPORTANT: Static routes must be ABOVE @Get(':id') or NestJS treats them as params

  @Get('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List table listings within the caller's own business(es) — requires TABLE_CLUB scope" })
  async listListings(
    @CurrentUser() user: any,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @Query('venueId') venueId?: string,
    @BusinessIds() businessIds?: string[],
    @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes }, BusinessScope.TABLE_CLUB)) {
      return { listings: [], total: 0 };
    }
    return this.tablesService.getAllListings(Number(limit), Number(offset), venueId, businessIds);
  }

  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Create a table listing under one of the caller's own venues/events" })
  async createListing(
    @Body() data: any,
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
    @ActiveBusinessScopes() activeBusinessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes: activeBusinessScopes }, BusinessScope.TABLE_CLUB)) {
      throw new ForbiddenException('This business is not set up for tables — ask a super admin to add the scope.');
    }
    return this.tablesService.createListing(data, businessIds);
  }

  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Update a table listing, within one of the caller's own business(es)" })
  async updateListing(
    @Param('id') id: string, @Body() data: any, @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[], @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes }, BusinessScope.TABLE_CLUB)) {
      throw new ForbiddenException('You are not assigned to the table/club business.');
    }
    return this.tablesService.updateListing(id, data, businessIds);
  }

  @Delete('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Delete a table listing, within one of the caller's own business(es)" })
  @HttpCode(204)
  async deleteListing(
    @Param('id') id: string, @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[], @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes }, BusinessScope.TABLE_CLUB)) {
      throw new ForbiddenException('You are not assigned to the table/club business.');
    }
    return this.tablesService.deleteListing(id, businessIds);
  }

  @Patch('listings/:id/position')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Update table floor plan position, within one of the caller's own business(es)" })
  async updateTablePosition(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() positionData: {
      x: number;
      y: number;
      rotation: number;
      width: number;
      height: number;
    },
    @BusinessIds() businessIds?: string[],
    @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    if (!hasBusinessScope({ role: user.role, businessScopes }, BusinessScope.TABLE_CLUB)) {
      throw new ForbiddenException('You are not assigned to the table/club business.');
    }
    return this.tablesService.updateTablePosition(id, positionData, businessIds);
  }

  // ── Customer routes (below static routes) ────────────────────────────────

  @Get('venue/:venueId')
  @Roles(UserRole.CUSTOMER)
  async getVenueTables(@Param('venueId') venueId: string) {
    return this.tablesService.getVenueTables(venueId);
  }

  @Get('event/:eventId')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Get tables registered directly against a one-off event (no venue record)' })
  async getEventTables(@Param('eventId') eventId: string) {
    return this.tablesService.getEventTables(eventId);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async getBooking(@Param('id') bookingId: string, @CurrentUser() user: any) {
    return this.tablesService.getTableBooking(bookingId, user.id);
  }
}