import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType, TableCategory, CommissionPayer } from '../../shared/enums';
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
  private readonly SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(TableListing)
    private tableListingRepository: Repository<TableListing>,
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
    private auditService: AuditService,
  ) {}

  private async getPlatformSettings(): Promise<PlatformSettings> {
    let settings = await this.platformSettingsRepository.findOne({ where: { id: this.SINGLETON_ID } });
    if (!settings) {
      settings = this.platformSettingsRepository.create({ id: this.SINGLETON_ID });
      await this.platformSettingsRepository.save(settings);
    }
    return settings;
  }

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

    // Get platform settings for commission rate and service charge
    const platformSettings = await this.getPlatformSettings();
    const commissionRate = Number(platformSettings.commissionRate) || 0.03;
    const serviceCharge = Number(platformSettings.serviceCharge) || 400;
    const commissionPayer = platformSettings.commissionPayer || CommissionPayer.USER;
    const basePrice = createTableBookingDto.price;
    const commission = basePrice * commissionRate;

    const booking = new Booking();
    booking.bookingType = BookingType.TABLE;
    booking.userId = userId;
    booking.resourceId = createTableBookingDto.tableId;
    booking.basePrice = basePrice;
    booking.guestCount = createTableBookingDto.guestCount;
    booking.serviceCharge = serviceCharge;
    booking.platformCommission = commission;

    // If USER pays commission: add to total
    if (commissionPayer === CommissionPayer.USER) {
      booking.totalAmount = basePrice + serviceCharge + commission;
    } else {
      booking.totalAmount = basePrice + serviceCharge;
    }

    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;
    booking.metadata = {
      venueId: createTableBookingDto.venueId,
      bookingDate: createTableBookingDto.bookingDate,
      commissionPayer,
      commissionRate,
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

  // ── Admin: Table Listings Management ─────────────────────────────────────

  async getAllListings(limit = 50, offset = 0, venueId?: string) {
    const where: any = {};
    if (venueId) where.venueId = venueId;
    const [listings, total] = await this.tableListingRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { listings, total };
  }

  async createListing(data: Partial<TableListing>): Promise<TableListing> {
    const listing = this.tableListingRepository.create(data);
    return this.tableListingRepository.save(listing);
  }

  async updateListing(id: string, data: Partial<TableListing>): Promise<TableListing> {
    const listing = await this.tableListingRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Table listing not found');
    Object.assign(listing, data);
    return this.tableListingRepository.save(listing);
  }

  async deleteListing(id: string): Promise<void> {
    const listing = await this.tableListingRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Table listing not found');
    await this.tableListingRepository.delete(id);
  }
}