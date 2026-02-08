import { Controller, Post, Get, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { ApartmentsService } from './apartments.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Apartments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('apartments')
export class ApartmentsController {
  constructor(private apartmentsService: ApartmentsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async bookApartment(
    @Body() createApartmentBookingDto: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.apartmentsService.bookApartment(user.id, createApartmentBookingDto, ipAddress);
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  async getMyBookings(@CurrentUser() user: any, @Body() query: any) {
    const [bookings, total] = await this.apartmentsService.getUserApartmentBookings(
      user.id,
      query.limit || 20,
      query.offset || 0,
    );
    return { bookings, total };
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async getBooking(@Param('id') bookingId: string) {
    return this.apartmentsService.getApartmentBooking(bookingId);
  }
}