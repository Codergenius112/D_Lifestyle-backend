import {
  Controller, Get, Patch, Post, Body, Param,
  UseGuards, HttpCode, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { UpdateBookingStatusDto, BookingResponseDto } from '../../shared/dtos/booking.dto';
import { BookingService } from '../bookings/bookings.service';
import { Booking } from '../../shared/entities/booking.entity';
import { UserRole, BookingStatus, BookingType } from '../../shared/enums';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

class WalkInBookingDto {
  @IsString() tableId: string;
  @IsString() guestName: string;
  @IsNumber() @Min(1) guestCount: number;
  @IsOptional() @IsString() notes?: string;
}

@ApiTags('Admin - Bookings Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(
    private bookingService: BookingService,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all bookings (paginated, filtered)' })
  async listAllBookings(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('status') status?: string,
    @Query('bookingType') bookingType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const qb = this.bookingRepo.createQueryBuilder('b')
      .leftJoinAndSelect('b.user', 'u')
      .leftJoinAndSelect('b.payments', 'p')
      .select(['b', 'u.id', 'u.firstName', 'u.lastName', 'u.email', 'p'])
      .where('b.isDeleted = false');

    if (status)      qb.andWhere('b.status = :status', { status });
    if (bookingType) qb.andWhere('b.bookingType = :bookingType', { bookingType });
    if (startDate)   qb.andWhere('b.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate)     qb.andWhere('b.createdAt <= :endDate', { endDate: new Date(endDate) });
    if (search) {
      qb.andWhere('(b.id ILIKE :search OR u.email ILIKE :search)', { search: `%${search}%` });
    }

    qb.take(+limit).skip(+offset).orderBy('b.createdAt', 'DESC');
    const [data, total] = await qb.getManyAndCount();
    return { data, total, limit: +limit, offset: +offset };
  }

  @Get('tables')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all table bookings' })
  async listTableBookings(
    @Query('status') status?: string,
    @Query('limit') limit = '50',
  ) {
    const qb = this.bookingRepo.createQueryBuilder('b')
      .leftJoinAndSelect('b.user', 'u')
      .select(['b', 'u.id', 'u.firstName', 'u.lastName', 'u.email'])
      .where('b.bookingType = :type', { type: BookingType.TABLE })
      .andWhere('b.isDeleted = false');
    if (status) qb.andWhere('b.status = :status', { status });
    qb.take(+limit).orderBy('b.createdAt', 'DESC');
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  @Post('tables/walk-in')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a manual walk-in table booking' })
  async createWalkIn(@Body() dto: WalkInBookingDto, @CurrentUser() user: any) {
    const booking = this.bookingRepo.create({
      bookingType: BookingType.TABLE,
      resourceId:  dto.tableId,
      userId:      user.id,
      guestCount:  dto.guestCount,
      status:      BookingStatus.CONFIRMED,
      basePrice:   0,
      totalAmount: 0,
      metadata:    { guestName: dto.guestName, notes: dto.notes, isWalkIn: true },
    });
    return this.bookingRepo.save(booking);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get booking details (admin)' })
  async getBookingDetails(@Param('id') bookingId: string): Promise<BookingResponseDto> {
    return this.bookingService.getBooking(bookingId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Override booking status (admin)' })
  async overrideBookingStatus(
    @Param('id') bookingId: string,
    @Body() updateStatusDto: UpdateBookingStatusDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ): Promise<BookingResponseDto> {
    return this.bookingService.updateBookingStatus(
      bookingId, updateStatusDto.status as any, user.id, ipAddress,
    );
  }

  @Post(':id/caution-fee/refund')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Refund caution fee to customer wallet' })
  async refundCautionFee(
    @Param('id') bookingId: string,
    @CurrentUser() user: any,
  ) {
    return this.bookingService.resolveCautionFee(bookingId, 'REFUNDED', user.id);
  }

  @Post(':id/caution-fee/forfeit')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Forfeit caution fee (customer gets nothing)' })
  async forfeitCautionFee(
    @Param('id') bookingId: string,
    @CurrentUser() user: any,
  ) {
    return this.bookingService.resolveCautionFee(bookingId, 'FORFEITED', user.id);
  }
}