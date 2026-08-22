import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Order } from '../../shared/entities/order.entity';
import { OrderStatus, AuditActionType, BusinessScope, BookingType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private auditService: AuditService,
  ) {}

  async createOrder(
    target: { bookingId?: string | null; venueId?: string | null; eventId?: string | null },
    userId: string,
    items: any[],
    ipAddress: string,
    locationData?: {
      type: 'table' | 'ticket';
      tableInfo?: {
        tableId: string;
        tableName: string;
        category: string;
        venueId: string;
      };
      pickupLocation?: string;
    },
  ): Promise<Order> {
    if (!items?.length) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const targetCount = [target.bookingId, target.venueId, target.eventId].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        'Order must be tied to exactly one of a booking, a venue, or an event',
      );
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    );

    const order = new Order();
    order.bookingId   = target.bookingId ?? null;
    order.venueId     = target.venueId ?? null;
    order.eventId     = target.eventId ?? null;
    order.userId      = userId;
    order.items       = items;
    order.totalAmount = totalAmount;
    order.status      = OrderStatus.CREATED;

    if (locationData) {
      if (locationData.type === 'table' && locationData.tableInfo) {
        order.tableInfo = locationData.tableInfo;
      } else if (locationData.type === 'ticket' && locationData.pickupLocation) {
        order.pickupLocation = locationData.pickupLocation;
      }
    }

    const savedOrder = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType:   AuditActionType.ORDER_CREATED,
      actorId:      userId,
      resourceType: 'order',
      resourceId:   savedOrder.id,
      changes:      { itemCount: items.length, total: totalAmount },
      ipAddress,
    });

    return savedOrder;
  }

  async getOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return order;
  }

  async getOrdersByUser(userId: string, limit = 20, offset = 0): Promise<{
    orders: Order[];
    total: number;
  }> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { orders, total };
  }

  async getOrdersByBooking(bookingId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrdersByAssignedWaiter(waiterId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { assignedToUserId: waiterId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrdersByStation(stationId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { routedToStationId: stationId, status: OrderStatus.IN_PREPARATION },
      order: { createdAt: 'ASC' },
    });
  }

  async getAllOrders(
    limit = 50, offset = 0, bookingTypes?: string[],
    owned?: { tableListingIds: string[]; apartmentListingIds: string[]; carListingIds: string[]; eventIds: string[]; venueIds: string[] },
    startDate?: string, endDate?: string,
  ): Promise<{ orders: Order[]; total: number }> {
    // Once precise per-owner scoping (owned) is available, it's strictly
    // more accurate than the category-level bookingTypes check — skip the
    // latter entirely rather than ANDing them, since a mismatch between a
    // business's assigned categories and what it actually owns (e.g. an
    // event created without EVENT_TICKETING in businessScopes) would
    // otherwise silently hide orders that genuinely belong to that owner.
    if (!owned && bookingTypes && bookingTypes.length === 0) {
      return { orders: [], total: 0 };
    }

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.booking', 'booking')
      .orderBy('order.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (startDate) qb.andWhere('order."createdAt" >= :startDate', { startDate });
    if (endDate)   qb.andWhere('order."createdAt" <= :endDate',   { endDate });

    if (!owned && bookingTypes) {
      qb.andWhere(new Brackets((sub) => {
        sub.where('booking.bookingType IN (:...types)', { types: bookingTypes });
        if (bookingTypes.includes(BookingType.TABLE)) {
          sub.orWhere('order.venueId IS NOT NULL');
        }
        if (bookingTypes.includes(BookingType.TICKET)) {
          sub.orWhere('order.eventId IS NOT NULL');
        }
      }));
    }

    this.applyOwnedFilter(qb, owned);

    const [orders, total] = await qb.getManyAndCount();
    return { orders, total };
  }

  // Live orders dashboard was previously completely unscoped — any admin
  // could see every non-completed order on the entire platform, across
  // every business. Now scoped exactly like getAllOrders, with the same
  // "ownership supersedes category" rule.
  async getLiveOrders(
    bookingTypes?: string[],
    owned?: { tableListingIds: string[]; apartmentListingIds: string[]; carListingIds: string[]; eventIds: string[]; venueIds: string[] },
  ): Promise<Order[]> {
    if (!owned && bookingTypes && bookingTypes.length === 0) return [];

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.booking', 'booking')
      .where('order.status NOT IN (:...statuses)', {
        statuses: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.SERVED],
      })
      .orderBy('order.createdAt', 'ASC');

    if (!owned && bookingTypes) {
      qb.andWhere(new Brackets((sub) => {
        sub.where('booking.bookingType IN (:...types)', { types: bookingTypes });
        if (bookingTypes.includes(BookingType.TABLE)) {
          sub.orWhere('order.venueId IS NOT NULL');
        }
        if (bookingTypes.includes(BookingType.TICKET)) {
          sub.orWhere('order.eventId IS NOT NULL');
        }
      }));
    }

    this.applyOwnedFilter(qb, owned);

    return qb.getMany();
  }

  // Shared by getAllOrders and getLiveOrders — restricts to a specific
  // business owner's own resources, on top of whatever category-level
  // (bookingTypes) filtering has already been applied.
  private applyOwnedFilter(
    qb: any,
    owned?: { tableListingIds: string[]; apartmentListingIds: string[]; carListingIds: string[]; eventIds: string[]; venueIds: string[] },
  ): void {
    if (!owned) return;
    qb.andWhere(new Brackets((sub: any) => {
      let addedAny = false;
      const add = (clause: string, params: any) => {
        addedAny ? sub.orWhere(clause, params) : sub.where(clause, params);
        addedAny = true;
      };
      if (owned.tableListingIds.length) {
        add('(booking."bookingType" = :ttype AND booking."resourceId" IN (:...tIds))',
          { ttype: BookingType.TABLE, tIds: owned.tableListingIds });
      }
      if (owned.apartmentListingIds.length) {
        add('(booking."bookingType" = :atype AND booking."resourceId" IN (:...aIds))',
          { atype: BookingType.APARTMENT, aIds: owned.apartmentListingIds });
      }
      if (owned.carListingIds.length) {
        add('(booking."bookingType" = :ctype AND booking."resourceId" IN (:...cIds))',
          { ctype: BookingType.CAR, cIds: owned.carListingIds });
      }
      if (owned.eventIds.length) {
        add('((booking."bookingType" = :ktype AND booking."resourceId" IN (:...eIds)) OR order."eventId" IN (:...eIds))',
          { ktype: BookingType.TICKET, eIds: owned.eventIds });
      }
      if (owned.venueIds.length) {
        add('order."venueId" IN (:...vIds)', { vIds: owned.venueIds });
      }
      if (!addedAny) sub.where('1 = 0');
    }));
  }

  async assignOrderToWaiter(
    orderId: string, waiterId: string, managerId: string, ipAddress: string,
  ): Promise<Order> {
    const order = await this.getOrder(orderId);
    order.assignedToUserId = waiterId;
    order.status           = OrderStatus.ASSIGNED;
    const updated = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType:   AuditActionType.ORDER_ASSIGNED,
      actorId:      managerId,
      resourceType: 'order',
      resourceId:   orderId,
      changes:      { assignedTo: waiterId },
      ipAddress,
    });
    return updated;
  }

  async routeOrderToStation(
    orderId: string, stationId: string, managerId: string, ipAddress: string,
  ): Promise<Order> {
    const order = await this.getOrder(orderId);
    order.routedToStationId = stationId;
    order.status            = OrderStatus.ROUTED;
    const updated = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType:   AuditActionType.ORDER_ASSIGNED,
      actorId:      managerId,
      resourceType: 'order',
      resourceId:   orderId,
      changes:      { routedTo: stationId },
      ipAddress,
    });
    return updated;
  }

  async updateOrderStatus(
    orderId: string, newStatus: OrderStatus, userId: string, ipAddress: string,
  ): Promise<Order> {
    const order     = await this.getOrder(orderId);
    const oldStatus = order.status;
    order.status    = newStatus;

    if (newStatus === OrderStatus.READY)     order.readyAt     = new Date();
    if (newStatus === OrderStatus.SERVED)    order.servedAt    = new Date();
    if (newStatus === OrderStatus.COMPLETED) order.completedAt = new Date();

    const updated = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType:   AuditActionType.ORDER_COMPLETED,
      actorId:      userId,
      resourceType: 'order',
      resourceId:   orderId,
      changes:      { status: { from: oldStatus, to: newStatus } },
      ipAddress,
    });
    return updated;
  }
}