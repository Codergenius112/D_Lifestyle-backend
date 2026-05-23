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
import { CarListingsService } from './car-listings.service';
import { UserRole } from '../../shared/enums';

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
  @Roles(UserRole.CUSTOMER)
  async getListings(
    @Query('city') city?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('transmission') transmission?: string,
    @Query('category') category?: string,
    @Query('withDriver') withDriver?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.carListingsService.getListings({
      city,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      transmission,
      category,
      withDriver: withDriver !== undefined ? withDriver === 'true' : undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
  }

 
  @Get('listings/:id')
  @Roles(UserRole.CUSTOMER)
  async getListing(@Param('id') id: string) {
    return this.carListingsService.getListing(id);
  }

  
  @Post('listings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createListing(@Body() dto: any) {
    return this.carListingsService.createListing(dto);
  }

 
  @Patch('listings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateListing(@Param('id') id: string, @Body() dto: any) {
    return this.carListingsService.updateListing(id, dto);
  }


  @Delete('listings/:id')
  @Roles(UserRole.ADMIN)
  async deactivateListing(@Param('id') id: string) {
    return this.carListingsService.deactivateListing(id);
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