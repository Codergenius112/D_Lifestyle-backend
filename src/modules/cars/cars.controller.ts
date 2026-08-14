import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { CarsService } from './cars.service';
import { CarListingsService, CreateCarListingDto, UpdateCarListingDto } from './car-listings.service';
import { UserRole } from '../../shared/enums';
import { effectiveOwnerId } from '../../shared/utils/business-scope.util';

@ApiTags('Cars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
      ownerId: isStaff ? effectiveOwnerId(user) : undefined,
      activeOnly: !isStaff,
    });
  }

 
  @Get('listings/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getListing(@Param('id') id: string, @CurrentUser() user: any) {
    const isStaff = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN].includes(user.role);
    return this.carListingsService.getListing(id, isStaff ? effectiveOwnerId(user) : undefined);
  }

  
  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createListing(@Body() dto: CreateCarListingDto, @CurrentUser() user: any) {
    // Stamp the actual business owner, not whoever clicked create.
    return this.carListingsService.createListing({ ...dto, managedBy: effectiveOwnerId(user) });
  }

 
  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateListing(@Param('id') id: string, @Body() dto: UpdateCarListingDto, @CurrentUser() user: any) {
    return this.carListingsService.updateListing(id, dto, effectiveOwnerId(user));
  }


  @Delete('listings/:id')
  @Roles(UserRole.ADMIN)
  async deactivateListing(@Param('id') id: string, @CurrentUser() user: any) {
    return this.carListingsService.deactivateListing(id, effectiveOwnerId(user));
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
  async getRental(@Param('id') rentalId: string) {
    return this.carsService.getCarRental(rentalId);
  }
}