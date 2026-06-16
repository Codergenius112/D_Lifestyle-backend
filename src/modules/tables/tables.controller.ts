import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { TablesService } from './tables.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  // ── IMPORTANT: must be above @Get(':id') or NestJS will treat
  //   'venue' as a booking UUID and 404 every time ─────────────────────────
  @Get('venue/:venueId')
  @Roles(UserRole.CUSTOMER)
  async getVenueTables(@Param('venueId') venueId: string) {
    return this.tablesService.getVenueTables(venueId);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async getBooking(@Param('id') bookingId: string) {
    return this.tablesService.getTableBooking(bookingId);
  }

  // ── Admin: Table Listings Management ─────────────────────────────────────

  @Get('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all table listings (admin)' })
  async listListings(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @Query('venueId') venueId?: string,
  ) {
    return this.tablesService.getAllListings(Number(limit), Number(offset), venueId);
  }

  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a table listing' })
  async createListing(@Body() data: any) {
    return this.tablesService.createListing(data);
  }

  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a table listing' })
  async updateListing(@Param('id') id: string, @Body() data: any) {
    return this.tablesService.updateListing(id, data);
  }

  @Delete('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a table listing' })
  @HttpCode(204)
  async deleteListing(@Param('id') id: string) {
    return this.tablesService.deleteListing(id);
  }
}