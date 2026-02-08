import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';

interface CreateTableBookingDto {
  venueId: string;
  tableId: string;
  guestCount: number;
  bookingDate: string;
  price: number;
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
  ) {}

  async bookTable(
    userId: string,
    createTableBookingDto: CreateTableBookingDto,
    ipAddress: string,
  ): Promise<Booking> {
    // Check availability (simplified - in production check against other bookings)
    const existingBooking = await this.bookingRepository.findOne({
      where: {
        resourceId: createTableBookingDto.tableId,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (existingBooking) {
      throw new BadRequestException('Table not available for selected date');
    }

    const booking = new Booking();
    booking.bookingType = BookingType.TABLE;
    booking.userId = userId;
    booking.resourceId = createTableBookingDto.tableId;
    booking.basePrice = createTableBookingDto.price;
    booking.guestCount = createTableBookingDto.guestCount;
    booking.serviceCharge = 400;
    booking.platformCommission = createTableBookingDto.price * 0.03;
    booking.totalAmount = createTableBookingDto.price + 400;
    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;
    booking.metadata = {
      venueId: createTableBookingDto.venueId,
      bookingDate: createTableBookingDto.bookingDate,
    };

    const saved = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_CREATED,
      actorId: userId,
      resourceType: 'table',
      resourceId: saved.id,
      changes: { guestCount: createTableBookingDto.guestCount, price: createTableBookingDto.price },
      ipAddress,
    });

    return saved;
  }

  async getTableBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, bookingType: BookingType.TABLE },
    });

    if (!booking) {
      throw new NotFoundException('Table booking not found');
    }

    return booking;
  }

  async getUserTableBookings(userId: string, limit = 20, offset = 0) {
    return this.bookingRepository.findAndCount({
      where: { userId, bookingType: BookingType.TABLE },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}