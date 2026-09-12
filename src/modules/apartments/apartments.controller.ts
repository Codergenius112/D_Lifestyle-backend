import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { IpAddress }    from '../../common/decorators/ip-address.decorator';
import { BusinessIds, ActiveBusinessId, ActiveBusinessScopes } from '../../common/decorators/business-context.decorator'; // ← CHANGED (scope fix)
import { ApartmentsService }        from './apartments.service';
import { ApartmentListingsService, CreateApartmentListingDto, UpdateApartmentListingDto } from './apartments-listings.services';
import { UserRole, BusinessScope } from '../../shared/enums';
import { effectiveOwnerId, hasBusinessScope } from '../../shared/utils/business-scope.util';

@ApiTags('Apartments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
@Controller('apartments')
export class ApartmentsController {
  constructor(
    private apartmentsService: ApartmentsService,
    private apartmentListingsService: ApartmentListingsService,
  ) {}

  @Get('listings')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List apartment listings — customers see the public catalog; staff see their own business(es) only, unless super admin' })
  async getListings(
    @CurrentUser() user: any,
    @Query('city') city?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.apartmentListingsService.getListings({
      city,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      limit:  limit  ? Number(limit)  : 20,
      offset: offset ? Number(offset) : 0,
      businessIds: isStaff ? businessIds : undefined,
      activeOnly: !isStaff,
    });
  }

  @Get('listings/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get apartment listing by ID' })
  async getListing(@Param('id') id: string, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.apartmentListingsService.getListing(id, isStaff ? businessIds : undefined);
  }

  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create apartment listing, owned by the caller\'s own business' })
  async createListing(
    @Body() dto: CreateApartmentListingDto, @CurrentUser() user: any,
    @ActiveBusinessId() activeBusinessId?: string | null,
    @ActiveBusinessScopes() activeBusinessScopes?: BusinessScope[],
  ) {
    if (!activeBusinessId) {
      throw new BadRequestException(
        'Could not determine which business this listing belongs to. If you manage more than one business, specify one via the X-Business-Id header.',
      );
    }
    if (!hasBusinessScope({ role: user.role, businessScopes: activeBusinessScopes }, BusinessScope.APARTMENT)) {
      throw new ForbiddenException('This business is not set up for apartments — ask a super admin to add the scope.');
    }
    // Stamp the actual business owner, not whoever clicked create — a
    // manager creating a listing shouldn't become its owner themselves.
    return this.apartmentListingsService.createListing({
      ...dto, managedBy: effectiveOwnerId(user), businessId: activeBusinessId,
    });
  }

  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update apartment listing, within one of the caller\'s own business(es)' })
  async updateListing(@Param('id') id: string, @Body() dto: UpdateApartmentListingDto, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.apartmentListingsService.updateListing(id, dto, businessIds);
  }

  @Delete('listings/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete apartment listing, within one of the caller\'s own business(es)' })
  async deactivateListing(@Param('id') id: string, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.apartmentListingsService.deactivateListing(id, businessIds);
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
  async getBooking(@Param('id') bookingId: string, @CurrentUser() user: any) {
    return this.apartmentsService.getApartmentBooking(bookingId, user.id);
  }
}