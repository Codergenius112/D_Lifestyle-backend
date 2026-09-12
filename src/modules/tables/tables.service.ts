import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType, CommissionPayer } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy — tables gap fix)

interface CreateTableBookingDto {
  venueId?: string;
  eventId?: string;
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
    private readonly businessContext: BusinessContextService, // ← NEW (multi-tenancy — tables gap fix)
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
  // Matches a well-formed UUID — a malformed venueId (e.g. leftover from a
  // different system, or manually typed by an admin) would otherwise hit
  // Postgres's uuid column type check and throw a hard 500 error instead of
  // gracefully returning "no tables", which is what actually broke Browse
  // Tables for at least one real event.
  private isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  async getVenueTables(venueId: string) {
    if (!venueId || !this.isValidUuid(venueId)) {
      return { tables: [], total: 0, venueId };
    }
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
    if (!eventId || !this.isValidUuid(eventId)) {
      return { tables: [], total: 0, eventId };
    }
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
  async getTableBooking(bookingId: string, userId: string): Promise<Booking> {
    // ← FIXED — previously omitted userId entirely, same bug found and
    // fixed in tickets.service.ts's getTicket: any authenticated customer
    // could view any OTHER customer's table booking by guessing the id.
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, userId, bookingType: BookingType.TABLE },
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
  // ← CHANGED (multi-tenancy — tables gap fix): this module was missed
  // entirely during the original multi-tenancy migration. table_listings
  // has no businessId column of its own by design (it resolves via its
  // parent venue or event — see Zentra Multi-Tenancy PRD, section 5.1,
  // "most can resolve it via their parent relation"), but that resolution
  // was never actually being done here: getAllListings had NO business
  // filtering at all (any admin saw every table listing platform-wide),
  // and update/delete/reposition had no ownership check at all (any
  // admin/manager could edit or delete any other business's tables).

  async getAllListings(limit = 50, offset = 0, venueId?: string, businessIds?: string[]) {
    if (businessIds && businessIds.length === 0) return { listings: [], total: 0 };

    const qb = this.tableListingRepository.createQueryBuilder('tl')
      .leftJoin('venues', 'v', 'v.id = tl."venueId"')
      .leftJoin('events', 'e', 'e.id = tl."eventId"');

    if (venueId) qb.andWhere('tl."venueId" = :venueId', { venueId });
    if (businessIds) {
      qb.andWhere('COALESCE(v."businessId", e."businessId") IN (:...businessIds)', { businessIds });
    }

    qb.orderBy('tl."createdAt"', 'DESC').take(limit).skip(offset);
    const [listings, total] = await qb.getManyAndCount();
    return { listings, total };
  }

  /** Resolves a table listing's business via its parent venue or event. */
  private async resolveListingBusinessId(listing: TableListing): Promise<string | null> {
    if (listing.venueId) return this.businessContext.resolveBusinessIdForVenue(listing.venueId);
    if (listing.eventId) return this.businessContext.resolveBusinessIdForEvent(listing.eventId);
    return null;
  }

  async createListing(data: Partial<TableListing>, businessIds?: string[]): Promise<TableListing> {
    const hasVenue = !!data.venueId;
    const hasEvent = !!data.eventId;
    if (hasVenue === hasEvent) {
      // both set, or neither set — not allowed
      throw new BadRequestException(
        'A table listing must belong to exactly one of venueId or eventId',
      );
    }

    // Verify the target venue/event actually belongs to the caller's own
    // business, BEFORE creating anything under it.
    if (businessIds !== undefined) {
      const targetBusinessId = data.venueId
        ? await this.businessContext.resolveBusinessIdForVenue(data.venueId)
        : await this.businessContext.resolveBusinessIdForEvent(data.eventId!);
      if (!targetBusinessId || !businessIds.length || !businessIds.includes(targetBusinessId)) {
        throw new NotFoundException(data.venueId ? 'Venue not found' : 'Event not found');
      }
    }

    const listing = this.tableListingRepository.create(data);
    return this.tableListingRepository.save(listing);
  }

  async updateListing(id: string, data: Partial<TableListing>, businessIds?: string[]): Promise<TableListing> {
    const listing = await this.tableListingRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Table listing not found');
    if (businessIds !== undefined) {
      const businessId = await this.resolveListingBusinessId(listing);
      if (!businessId || !businessIds.length || !businessIds.includes(businessId)) {
        throw new NotFoundException('Table listing not found');
      }
      await this.businessContext.assertBusinessActive(businessId);
    }
    Object.assign(listing, data);
    return this.tableListingRepository.save(listing);
  }

  async deleteListing(id: string, businessIds?: string[]): Promise<void> {
    const listing = await this.tableListingRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Table listing not found');
    if (businessIds !== undefined) {
      const businessId = await this.resolveListingBusinessId(listing);
      if (!businessId || !businessIds.length || !businessIds.includes(businessId)) {
        throw new NotFoundException('Table listing not found');
      }
      await this.businessContext.assertBusinessActive(businessId);
    }
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
    businessIds?: string[],
  ): Promise<TableListing> {
    const listing = await this.tableListingRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Table listing not found');
    if (businessIds !== undefined) {
      const businessId = await this.resolveListingBusinessId(listing);
      if (!businessId || !businessIds.length || !businessIds.includes(businessId)) {
        throw new NotFoundException('Table listing not found');
      }
      await this.businessContext.assertBusinessActive(businessId);
    }
    listing.floorPlanPosition = positionData as any;
    return this.tableListingRepository.save(listing);
  }
}