import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType, TableCategory, CommissionPayer } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';

interface CreateTableBookingDto {
  venueId?: string;
  eventId?: string;
  tableId: string;
  guestCount: number;
  bookingDate: string;
  price: number;
}

@Injectable()
export class TicketsService {
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

    return this.attachAvailability(listings, { venueId });
  }

  // ── GET /tables/event/:eventId ──────────────────────────────────────────────
  // For one-off spaces (stadiums, fields) with no permanent venue record —
  // tables are registered directly against the event instead.
  async getEventTables(eventId: string) {
    const listings = await this.tableListingRepository.find({
      where: { eventId, isActive: true },
      order: { price: 'ASC' },
    });

    return this.attachAvailability(listings, { eventId });
  }

  private async attachAvailability(
    listings: TableListing[],
    scope: { venueId?: string; eventId?: string },
  ) {
    if (!listings.length) {
      return { tables: [], total: 0, ...scope };
    }

    // Find all confirmed bookings for these table IDs
    const tableIds = listings.map((t) => t.id);
    const confirmedBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.resourceId IN (:...tableIds)', { tableIds })
      .andWhere('booking.bookingType = :type', { type: BookingType.TABLE })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .select(['booking.resourceId'])
      .getMany();

    const bookedTableIds = new Set(confirmedBookings.map((b) => b.resourceId));

    const tables = listings.map((listing) => ({
      id: listing.id,
      venueId: listing.venueId,
      eventId: listing.eventId,
      name: listing.name,
      category: listing.category,
      capacity: listing.capacity,
      price: Number(listing.price),
      description: listing.description,
      features: listing.features ?? [],
      available: !bookedTableIds.has(listing.id),
    }));

    return { tables, total: tables.length, ...scope };
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

    // Stored on the booking so downstream screens (My Bookings, confirmation)
    // can show a real table name without re-fetching the venue/event's whole
    // table catalog and matching by id every time they render.
    const tableListing = await this.tableListingRepository.findOne({
      where: { id: createTableBookingDto.tableId },
    });

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
      venueId: createTableBookingDto.venueId ?? null,
      eventId: createTableBookingDto.eventId ?? null,
      tableName: tableListing?.name ?? null,
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
    const hasVenue = !!data.venueId;
    const hasEvent = !!data.eventId;
    if (hasVenue === hasEvent) {
      // both set, or neither set — not allowed
      throw new BadRequestException(
        'A table listing must belong to exactly one of venueId or eventId',
      );
    }
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

  async updateTablePosition(
    id: string,
    positionData: {
      x: number;
      y: number;
      rotation: number;
      width: number;
      height: number;
    },
  ): Promise<TableListing> {
    const listing = await this.tableListingRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Table listing not found');
    listing.floorPlanPosition = positionData as any;
    return this.tableListingRepository.save(listing);
  }

  async createTicket(userId: string, createTicketDto: any, ipAddress: string): Promise<Booking> {
    const booking = this.bookingRepository.create({
      bookingType: BookingType.TICKET,
      userId,
      resourceId: createTicketDto?.resourceId ?? createTicketDto?.eventId ?? createTicketDto?.ticketTypeId ?? '',
      guestCount: createTicketDto?.guestCount ?? 1,
      basePrice: Number(createTicketDto?.price ?? 0),
      totalAmount: Number(createTicketDto?.price ?? 0),
      status: BookingStatus.INITIATED,
      paymentStatus: PaymentStatus.UNPAID,
      metadata: {
        eventId: createTicketDto?.eventId ?? null,
        ticketTypeId: createTicketDto?.ticketTypeId ?? null,
        guestName: createTicketDto?.guestName ?? null,
        notes: createTicketDto?.notes ?? null,
        ipAddress,
      },
    });

    return this.bookingRepository.save(booking);
  }

  async getUserTickets(userId: string, limit = 20, offset = 0) {
    return this.bookingRepository.findAndCount({
      where: { userId, bookingType: BookingType.TICKET },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getTicket(ticketId: string): Promise<Booking> {
    const ticket = await this.bookingRepository.findOne({
      where: { id: ticketId, bookingType: BookingType.TICKET },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async cancelTicket(ticketId: string, userId: string, ipAddress: string): Promise<Booking> {
    const ticket = await this.bookingRepository.findOne({
      where: { id: ticketId, userId, bookingType: BookingType.TICKET },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.status = BookingStatus.CANCELLED;
    ticket.cancelledAt = new Date();
    ticket.metadata = {
      ...(ticket.metadata ?? {}),
      cancelledByUser: true,
      ipAddress,
    };

    return this.bookingRepository.save(ticket);
  }
}