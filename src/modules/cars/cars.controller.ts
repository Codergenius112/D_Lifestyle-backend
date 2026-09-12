import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { BusinessIds, ActiveBusinessId, ActiveBusinessScopes } from '../../common/decorators/business-context.decorator'; // ← CHANGED (scope fix)
import { CarsService } from './cars.service';
import { CarListingsService, CreateCarListingDto, UpdateCarListingDto } from './car-listings.service';
import { UserRole, BusinessScope } from '../../shared/enums';
import { effectiveOwnerId, hasBusinessScope } from '../../shared/utils/business-scope.util';

@ApiTags('Cars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
@Controller('cars')
export class CarsController {
  constructor(
    private carsService: CarsService,
    private carListingsService: CarListingsService,
  ) {}

  
  @Get('listings')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getListings(
    @CurrentUser() user: any,
    @Query('city') city?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('transmission') transmission?: string,
    @Query('category') category?: string,
    @Query('withDriver') withDriver?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.carListingsService.getListings({
      city,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      transmission,
      category,
      withDriver: withDriver !== undefined ? withDriver === 'true' : undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      businessIds: isStaff ? businessIds : undefined,
      activeOnly: !isStaff,
    });
  }

 
  @Get('listings/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getListing(@Param('id') id: string, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.carListingsService.getListing(id, isStaff ? businessIds : undefined);
  }

  
  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createListing(
    @Body() dto: CreateCarListingDto, @CurrentUser() user: any,
    @ActiveBusinessId() activeBusinessId?: string | null,
    @ActiveBusinessScopes() activeBusinessScopes?: BusinessScope[],
  ) {
    if (!activeBusinessId) {
      throw new BadRequestException(
        'Could not determine which business this listing belongs to. If you manage more than one business, specify one via the X-Business-Id header.',
      );
    }
    if (!hasBusinessScope({ role: user.role, businessScopes: activeBusinessScopes }, BusinessScope.CAR_RENTAL)) {
      throw new ForbiddenException('This business is not set up for car rentals — ask a super admin to add the scope.');
    }
    // Stamp the actual business owner, not whoever clicked create.
    return this.carListingsService.createListing({
      ...dto, managedBy: effectiveOwnerId(user), businessId: activeBusinessId,
    });
  }

 
  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateListing(@Param('id') id: string, @Body() dto: UpdateCarListingDto, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.carListingsService.updateListing(id, dto, businessIds);
  }


  @Delete('listings/:id')
  @Roles(UserRole.ADMIN)
  async deactivateListing(@Param('id') id: string, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.carListingsService.deactivateListing(id, businessIds);
  }


  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async rentCar(
    @Body() createCarRentalDto: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.carsService.rentCar(user.id, createCarRentalDto, ipAddress);
  }


  @Get()
  @Roles(UserRole.CUSTOMER)
  async getMyRentals(@CurrentUser() user: any, @Body() query: any) {
    const [rentals, total] = await this.carsService.getUserCarRentals(
      user.id,
      query.limit || 20,
      query.offset || 0,
    );
    return { rentals, total };
  }


  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async getRental(@Param('id') rentalId: string, @CurrentUser() user: any) {
    return this.carsService.getCarRental(rentalId, user.id);
  }
}