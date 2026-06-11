import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { IpAddress }    from '../../common/decorators/ip-address.decorator';
import { ApartmentsService }        from './apartments.service';
import { ApartmentListingsService } from './apartments-listings.services';
import { UserRole } from '../../shared/enums';

@ApiTags('Apartments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('apartments')
export class ApartmentsController {
  constructor(
    private apartmentsService: ApartmentsService,
    private apartmentListingsService: ApartmentListingsService,
  ) {}

  @Get('listings')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List apartment listings' })
  async getListings(
    @Query('city') city?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.apartmentListingsService.getListings({
      city,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      limit:  limit  ? Number(limit)  : 20,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get('listings/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get apartment listing by ID' })
  async getListing(@Param('id') id: string) {
    return this.apartmentListingsService.getListing(id);
  }

  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create apartment listing (admin)' })
  async createListing(@Body() dto: any, @CurrentUser() user: any) {
    return this.apartmentListingsService.createListing({ ...dto, managedBy: user.id });
  }

  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update apartment listing (admin)' })
  async updateListing(@Param('id') id: string, @Body() dto: any) {
    return this.apartmentListingsService.updateListing(id, dto);
  }

  @Delete('listings/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete apartment listing (admin)' })
  async deactivateListing(@Param('id') id: string) {
    return this.apartmentListingsService.deactivateListing(id);
  }

  // ─── Customer booking endpoints ───────────────────────────────────────────

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Book an apartment (customer)' })
  async bookApartment(
    @Body() dto: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.apartmentsService.bookApartment(user.id, dto, ipAddress);
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Get my apartment bookings (customer)' })
  async getMyBookings(@CurrentUser() user: any) {
    const [bookings, total] = await this.apartmentsService.getUserApartmentBookings(user.id, 20, 0);
    return { bookings, total };
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Get apartment booking by ID (customer)' })
  async getBooking(@Param('id') bookingId: string) {
    return this.apartmentsService.getApartmentBooking(bookingId);
  }
}