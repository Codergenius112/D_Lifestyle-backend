import { Controller, Post, Get, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { CarsService } from './cars.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Cars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cars')
export class CarsController {
  constructor(private carsService: CarsService) {}

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