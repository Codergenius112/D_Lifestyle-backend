import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { BookingService } from './bookings.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingService: BookingService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async createBooking(
    @Body() createBookingDto: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.bookingService.createBooking(createBookingDto, user.id, ipAddress);
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  async listBookings(
    @CurrentUser() user: any,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    const [bookings, total] = await this.bookingService.listUserBookings(
      user.id,
      limit,
      offset,
    );
    return { bookings, total };
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async getBooking(@Param('id') bookingId: string) {
    return this.bookingService.getBooking(bookingId);
  }

  @Patch(':id/status')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async updateStatus(
    @Param('id') bookingId: string,
    @Body() body: { status: string },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.bookingService.updateBookingStatus(
      bookingId,
      body.status as any,
      user.id,
      ipAddress,
    );
  }

  @Post(':id/checkin')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async checkIn(
    @Param('id') bookingId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.bookingService.updateBookingStatus(
      bookingId,
      'CHECKED_IN' as any,
      user.id,
      ipAddress,
    );
  }
}