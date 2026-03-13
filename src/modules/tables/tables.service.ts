import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
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
    @InjectRepository(TableListing)
    private tableListingRepository: Repository<TableListing>,
    private auditService: AuditService,
  ) {}

  // ── GET /tables/venue/:venueId ─────────────────────────────────────────────
  async getVenueTables(venueId: string) {
    // 1. Fetch all active listings for this venue
    const listings = await this.tableListingRepository.find({
      where: { venueId, isActive: true },
      order: { price: 'ASC' },
    });

    if (!listings.length) {
      return { tables: [], total: 0, venueId };
    }

    // 2. Find all confirmed bookings for these table IDs
    const tableIds = listings.map((t) => t.id);
    const confirmedBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.resourceId IN (:...tableIds)', { tableIds })
      .andWhere('booking.bookingType = :type', { type: BookingType.TABLE })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .select(['booking.resourceId'])
      .getMany();

    const bookedTableIds = new Set(confirmedBookings.map((b) => b.resourceId));

    // 3. Return listings with live availability flag
    const tables = listings.map((listing) => ({
      id: listing.id,
      venueId: listing.venueId,
      name: listing.name,
      category: listing.category,
      capacity: listing.capacity,
      price: Number(listing.price),
      description: listing.description,
      features: listing.features ?? [],
      available: !bookedTableIds.has(listing.id),
    }));

    return { tables, total: tables.length, venueId };
  }

  // ── POST /tables ───────────────────────────────────────────────────────────
  async bookTable(
    userId: string,
    createTableBookingDto: CreateTableBookingDto,
    ipAddress: string,
  ): Promise<Booking> {
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

  // ── GET /tables/:id ────────────────────────────────────────────────────────
  async getTableBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, bookingType: BookingType.TABLE },
    });

    if (!booking) {
      throw new NotFoundException('Table booking not found');
    }

    return booking;
  }

  // ── GET /tables ────────────────────────────────────────────────────────────
  async getUserTableBookings(userId: string, limit = 20, offset = 0) {
    return this.bookingRepository.findAndCount({
      where: { userId, bookingType: BookingType.TABLE },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}