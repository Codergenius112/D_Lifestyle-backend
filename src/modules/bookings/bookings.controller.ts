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
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy — bookings gap fix)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { BusinessIds } from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy — bookings gap fix)
import { BookingService } from './bookings.service';
import { GroupBookingCountdownService } from './group-booking-countdown.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy — bookings gap fix)
@Controller('bookings')
export class BookingsController {
  constructor(
    private bookingService: BookingService,
    private groupBookingCountdownService: GroupBookingCountdownService,
  ) {}

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

  // ── Group Bookings ─────────────────────────────────────────────────────────
  // Static routes must stay ABOVE @Get(':id') / @Patch(':id/status') below,
  // same reasoning as the tables module — otherwise "group" gets swallowed
  // as an :id param.

  @Post('group')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async createGroupBooking(
    @Body() body: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.bookingService.createGroupBooking(user.id, body, ipAddress);
  }

  @Get('group/:id')
  @Roles(UserRole.CUSTOMER)
  async getGroupBookingStatus(@Param('id') id: string) {
    return this.groupBookingCountdownService.getGroupBookingStatus(id);
  }

  @Post('group/:id/contribute')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async contributeToGroupBooking(
    @Param('id') id: string,
    @Body() body: { amount: number },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.bookingService.contributeToGroupBooking(id, user.id, body.amount, ipAddress);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async getBooking(@Param('id') bookingId: string, @CurrentUser() user: any) {
    // ← FIXED (multi-tenancy — bookings gap fix) — previously NO userId
    // check at all: any customer could view any other customer's booking
    // by guessing the id. Same bug pattern found and fixed in
    // tickets.getTicket and tables.getTableBooking.
    const booking = await this.bookingService.getBooking(bookingId);
    if ((booking as any).userId !== user.id) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
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
    // ← FIXED (multi-tenancy — bookings gap fix) — previously a customer
    // could update/cancel ANY other customer's booking, not just their
    // own; updateBookingStatus now enforces ownership when actorRole is
    // passed.
    return this.bookingService.updateBookingStatus(
      bookingId,
      body.status as any,
      user.id,
      ipAddress,
      user.role,
    );
  }

  @Post(':id/checkin')
  @Roles(UserRole.CUSTOMER, UserRole.DOOR_STAFF, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  async checkIn(
    @Param('id') bookingId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @BusinessIds() businessIds?: string[], // ← NEW (multi-tenancy — bookings gap fix)
  ) {
    // ← FIXED (multi-tenancy — bookings gap fix) — previously a door-staff
    // member (or admin/manager) from ANY business could check in ANY
    // booking on the platform, and a customer could check in any OTHER
    // customer's booking. Now enforced per caller type — see
    // updateBookingStatus.
    return this.bookingService.updateBookingStatus(
      bookingId,
      'CHECKED_IN' as any,
      user.id,
      ipAddress,
      user.role,
      businessIds,
    );
  }
}