import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';

interface CreateCarRentalDto {
  carId: string;
  pickupDate: string;
  returnDate: string;
  price: number;
  driverLicense: string;
}

@Injectable()
export class CarsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
  ) {}

  async rentCar(
    userId: string,
    createCarRentalDto: CreateCarRentalDto,
    ipAddress: string,
  ): Promise<Booking> {
    // Check availability
    const existingBooking = await this.bookingRepository.findOne({
      where: {
        resourceId: createCarRentalDto.carId,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (existingBooking) {
      throw new BadRequestException('Car not available for selected dates');
    }

    const booking = new Booking();
    booking.bookingType = BookingType.CAR;
    booking.userId = userId;
    booking.resourceId = createCarRentalDto.carId;
    booking.basePrice = createCarRentalDto.price;
    booking.guestCount = 1;
    booking.serviceCharge = 400;
    booking.platformCommission = createCarRentalDto.price * 0.03;
    booking.totalAmount = createCarRentalDto.price + 400;
    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;
    booking.metadata = {
      pickupDate: createCarRentalDto.pickupDate,
      returnDate: createCarRentalDto.returnDate,
      driverLicense: createCarRentalDto.driverLicense,
      cautionFee: Math.ceil(createCarRentalDto.price * 0.2), // 20% caution fee
    };

    const saved = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_CREATED,
      actorId: userId,
      resourceType: 'car',
      resourceId: saved.id,
      changes: { pickupDate: createCarRentalDto.pickupDate, price: createCarRentalDto.price },
      ipAddress,
    });

    return saved;
  }

  async getCarRental(rentalId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: rentalId, bookingType: BookingType.CAR },
    });

    if (!booking) {
      throw new NotFoundException('Car rental not found');
    }

    return booking;
  }

  async getUserCarRentals(userId: string, limit = 20, offset = 0) {
    return this.bookingRepository.findAndCount({
      where: { userId, bookingType: BookingType.CAR },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}