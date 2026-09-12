import {
  Controller, Get, Patch, Post, Body, Param,
  UseGuards, HttpCode, Query, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { BusinessIds, ActiveBusinessId } from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy)
import { UpdateBookingStatusDto, BookingResponseDto } from '../../shared/dtos/booking.dto';
import { BookingService } from '../bookings/bookings.service';
import { Booking } from '../../shared/entities/booking.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
import { Venue } from '../../shared/entities/venue.entity';
import { UserRole, BookingStatus, BookingType } from '../../shared/enums';
import { IsString, IsOptional, IsNumber, Min, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryService } from '../inventory/inventory.service';
import { OrderService } from '../orders/orders.service';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

class WalkInOrderItemDto {
  @IsOptional() @IsString() itemId?: string;
  @IsString() name: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() specialInstructions?: string;
}

class WalkInBookingDto {
  @IsString() tableId: string;
  @IsString() guestName: string;
  @IsNumber() @Min(1) guestCount: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() @Min(0) salesAmount?: number;
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WalkInOrderItemDto)
  items?: WalkInOrderItemDto[];
  @IsOptional() @IsString() inventoryItemId?: string;
  @IsOptional() @IsNumber() @Min(1) inventoryQuantity?: number;
  @IsOptional() @IsString() inventoryReason?: string;
  @IsOptional() @IsBoolean() includeDefaultOrder?: boolean;
}

@ApiTags('Admin - Bookings Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(
    private bookingService: BookingService,
    private readonly inventoryService: InventoryService,
    private readonly orderService: OrderService,
    private readonly businessContext: BusinessContextService, // ← CHANGED (multi-tenancy)
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(TableListing)
    private readonly tableListingRepo: Repository<TableListing>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all bookings (paginated, filtered) — scoped to the caller\'s business(es) unless super admin' })
  async listAllBookings(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('status') status?: string,
    @Query('bookingType') bookingType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    const qb = this.bookingRepo.createQueryBuilder('b')
      .leftJoinAndSelect('b.user', 'u')
      .leftJoinAndSelect('b.payments', 'p')
      .select(['b', 'u.id', 'u.firstName', 'u.lastName', 'u.email', 'p'])
      .where('b.isDeleted = false');

    // ← CHANGED (multi-tenancy): businessIds replaces effectiveOwnerId +
    // OwnershipResolverService's polymorphic resourceId join — bookings now
    // carry a direct businessId column, so this is a plain equality check.
    // undefined = super admin, no restriction. [] = no accessible business,
    // matches nothing. Non-empty = restrict to those business(es) — this is
    // also what correctly isolates one owner's multiple businesses from
    // each other, which the old ownerId-only check could not do.
    if (businessIds !== undefined) {
      if (!businessIds.length) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('b."businessId" IN (:...businessIds)', { businessIds });
      }
    }

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
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    const qb = this.bookingRepo.createQueryBuilder('b')
      .leftJoinAndSelect('b.user', 'u')
      .select(['b', 'u.id', 'u.firstName', 'u.lastName', 'u.email'])
      .where('b.bookingType = :type', { type: BookingType.TABLE })
      .andWhere('b.isDeleted = false');

    if (businessIds !== undefined) {
      if (!businessIds.length) return { data: [], total: 0 };
      qb.andWhere('b."businessId" IN (:...businessIds)', { businessIds });
    }

    if (status) qb.andWhere('b.status = :status', { status });
    qb.take(+limit).orderBy('b.createdAt', 'DESC');
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  @Post('tables/walk-in')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.BAR_STAFF, UserRole.KITCHEN_STAFF, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a manual walk-in table booking and register sales/inventory activity' })
  async createWalkIn(
    @Body() dto: WalkInBookingDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @BusinessIds() businessIds?: string[], // ← NEW (multi-tenancy)
  ) {
    const listing = await this.tableListingRepo.findOne({ where: { id: dto.tableId } });
    if (!listing) {
      throw new NotFoundException('Table listing not found');
    }

    let venue: Venue | null = null;
    if (listing.venueId) {
      venue = await this.venueRepo.findOne({ where: { id: listing.venueId, isDeleted: false } });
      if (venue && !venue.allowWalkInOrders) {
        throw new BadRequestException('Walk-in orders are disabled for this venue');
      }
    }

    // ← NEW (multi-tenancy) — resolve which business this table belongs to
    // (via its venue, or its event for event-scoped tables), and reject the
    // walk-in outright if the caller has no access to that business, or if
    // that business is currently suspended.
    const tableBusinessId = venue?.businessId
      ?? (listing.eventId ? await this.businessContext.resolveBusinessIdForEvent(listing.eventId) : null);

    if (tableBusinessId) {
      if (businessIds !== undefined && !businessIds.includes(tableBusinessId)) {
        throw new ForbiddenException('You do not have access to this table\'s business.');
      }
      await this.businessContext.assertBusinessActive(tableBusinessId);
    }

    const booking = this.bookingRepo.create({
      bookingType: BookingType.TABLE,
      resourceId:  dto.tableId,
      userId:      user.id,
      guestCount:  dto.guestCount,
      status:      BookingStatus.CONFIRMED,
      basePrice:   0,
      totalAmount: 0,
      businessId:  tableBusinessId, // ← NEW (multi-tenancy)
      metadata:    {
        guestName: dto.guestName,
        notes: dto.notes,
        isWalkIn: true,
        createdByRole: user.role,
      },
    });
    const savedBooking = await this.bookingRepo.save(booking);

    const orderItems = (dto.items ?? []).map((item) => ({
      itemId: item.itemId ?? `${item.name}-${Date.now()}`,
      name: item.name,
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      specialInstructions: item.specialInstructions,
    }));

    const includeDefaultOrder = dto.includeDefaultOrder !== false;
    const defaultAmount = Number(dto.salesAmount ?? listing.price ?? 0);
    if (includeDefaultOrder && (!orderItems.length || defaultAmount > 0)) {
      orderItems.push({
        itemId: 'walk-in-service',
        name: 'Walk-in table service',
        quantity: 1,
        price: defaultAmount,
        specialInstructions: undefined,
      });
    }

    if (orderItems.length) {
      await this.orderService.createOrder(
        { bookingId: savedBooking.id },
        user.id,
        orderItems,
        ipAddress,
        {
          type: 'table',
          tableInfo: {
            tableId: listing.id,
            tableName: listing.name,
            category: listing.category,
            venueId: listing.venueId ?? '',
          },
        },
      );
    }

    if (dto.inventoryItemId && dto.inventoryQuantity) {
      await this.inventoryService.deduct(
        dto.inventoryItemId,
        Number(dto.inventoryQuantity),
        dto.inventoryReason ?? 'Walk-in order',
        user.id,
        user.role,
      );
    }

    return savedBooking;
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get booking details (admin)' })
  async getBookingDetails(
    @Param('id') bookingId: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingService.getBooking(bookingId);

    if (businessIds !== undefined) {
      const bookingBusinessId = (booking as any).businessId;
      if (!businessIds.length || !bookingBusinessId || !businessIds.includes(bookingBusinessId)) {
        throw new NotFoundException('Booking not found');
      }
    }

    return booking;
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
    @BusinessIds() businessIds?: string[], // ← NEW (multi-tenancy — bookings gap fix)
  ): Promise<BookingResponseDto> {
    // ← FIXED (multi-tenancy — bookings gap fix) — previously this admin
    // override endpoint had NO business ownership check at all: an admin
    // from ANY business could override the status of ANY booking on the
    // entire platform.
    return this.bookingService.updateBookingStatus(
      bookingId, updateStatusDto.status as any, user.id, ipAddress, user.role, businessIds,
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