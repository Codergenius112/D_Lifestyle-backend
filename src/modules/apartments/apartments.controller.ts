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
import { ApartmentListingsService, CreateApartmentListingDto, UpdateApartmentListingDto } from './apartments-listings.services';
import { UserRole } from '../../shared/enums';
import { effectiveOwnerId } from '../../shared/utils/business-scope.util';

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
  @ApiOperation({ summary: 'List apartment listings — customers see the public catalog; staff see their own business only, unless super admin' })
  async getListings(
    @CurrentUser() user: any,
    @Query('city') city?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.apartmentListingsService.getListings({
      city,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      limit:  limit  ? Number(limit)  : 20,
      offset: offset ? Number(offset) : 0,
      ownerId: isStaff ? effectiveOwnerId(user) : undefined,
      activeOnly: !isStaff,
    });
  }

  @Get('listings/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get apartment listing by ID' })
  async getListing(@Param('id') id: string, @CurrentUser() user: any) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.apartmentListingsService.getListing(id, isStaff ? effectiveOwnerId(user) : undefined);
  }

  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create apartment listing, owned by the caller\'s own business' })
  async createListing(@Body() dto: CreateApartmentListingDto, @CurrentUser() user: any) {
    // Stamp the actual business owner, not whoever clicked create — a
    // manager creating a listing shouldn't become its owner themselves.
    return this.apartmentListingsService.createListing({ ...dto, managedBy: effectiveOwnerId(user) });
  }

  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update apartment listing, within the caller\'s own business' })
  async updateListing(@Param('id') id: string, @Body() dto: UpdateApartmentListingDto, @CurrentUser() user: any) {
    return this.apartmentListingsService.updateListing(id, dto, effectiveOwnerId(user));
  }

  @Delete('listings/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete apartment listing, within the caller\'s own business' })
  async deactivateListing(@Param('id') id: string, @CurrentUser() user: any) {
    return this.apartmentListingsService.deactivateListing(id, effectiveOwnerId(user));
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