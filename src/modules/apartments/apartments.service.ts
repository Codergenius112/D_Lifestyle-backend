import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';

interface CreateApartmentBookingDto {
  apartmentId: string;
  checkInDate: string;
  checkOutDate: string;
  price: number;
}

@Injectable()
export class ApartmentsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
  ) {}

  async bookApartment(
    userId: string,
    createApartmentBookingDto: CreateApartmentBookingDto,
    ipAddress: string,
  ): Promise<Booking> {
    // Check availability
    const existingBooking = await this.bookingRepository.findOne({
      where: {
        resourceId: createApartmentBookingDto.apartmentId,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (existingBooking) {
      throw new BadRequestException('Apartment not available for selected dates');
    }

    const booking = new Booking();
    booking.bookingType = BookingType.APARTMENT;
    booking.userId = userId;
    booking.resourceId = createApartmentBookingDto.apartmentId;
    booking.basePrice = createApartmentBookingDto.price;
    booking.guestCount = 1;
    booking.serviceCharge = 400;
    booking.platformCommission = createApartmentBookingDto.price * 0.03;
    booking.totalAmount = createApartmentBookingDto.price + 400;
    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;
    booking.metadata = {
      checkInDate: createApartmentBookingDto.checkInDate,
      checkOutDate: createApartmentBookingDto.checkOutDate,
      cautionFee: Math.ceil(createApartmentBookingDto.price * 0.1), // 10% caution fee
    };

    const saved = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_CREATED,
      actorId: userId,
      resourceType: 'apartment',
      resourceId: saved.id,
      changes: { checkIn: createApartmentBookingDto.checkInDate, price: createApartmentBookingDto.price },
      ipAddress,
    });

    return saved;
  }

  async getApartmentBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, bookingType: BookingType.APARTMENT },
    });

    if (!booking) {
      throw new NotFoundException('Apartment booking not found');
    }

    return booking;
  }

  async getUserApartmentBookings(userId: string, limit = 20, offset = 0) {
    return this.bookingRepository.findAndCount({
      where: { userId, bookingType: BookingType.APARTMENT },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}