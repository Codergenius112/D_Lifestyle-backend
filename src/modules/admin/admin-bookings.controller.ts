import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { UpdateBookingStatusDto, BookingResponseDto } from '../../shared/dtos/booking.dto';
import { BookingService } from '../bookings/bookings.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Admin - Bookings Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private bookingService: BookingService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List all bookings (admin)' })
  async listAllBookings(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return { message: 'All bookings list' };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get booking details (admin)' })
  async getBookingDetails(@Param('id') bookingId: string): Promise<BookingResponseDto> {
    return this.bookingService.getBooking(bookingId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Override booking status (admin)' })
  async overrideBookingStatus(
    @Param('id') bookingId: string,
    @Body() updateStatusDto: UpdateBookingStatusDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ): Promise<BookingResponseDto> {
    return this.bookingService.updateBookingStatus(
      bookingId,
      updateStatusDto.status as any,
      user.id,
      ipAddress,
    );
  }
}