import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Order } from '../../shared/entities/order.entity';
import { OrderStatus, AuditActionType, BusinessScope, BookingType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private auditService: AuditService,
    private readonly businessContext: BusinessContextService, // ← NEW (multi-tenancy)
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

    // ← NEW (multi-tenancy) — stamp businessId at creation time, resolving
    // via whichever of bookingId/venueId/eventId was actually provided.
    if (target.bookingId) {
      const rows = await this.orderRepository.manager.query(
        `SELECT "businessId" FROM bookings WHERE id = $1`, [target.bookingId],
      );
      order.businessId = rows[0]?.businessId ?? null;
      // Freeze new orders against a booking whose business is suspended.
      await this.businessContext.assertBusinessActive(order.businessId);
    } else if (target.venueId) {
      order.businessId = await this.businessContext.resolveBusinessIdForVenue(target.venueId);
      await this.businessContext.assertBusinessActive(order.businessId);
    } else if (target.eventId) {
      order.businessId = await this.businessContext.resolveBusinessIdForEvent(target.eventId);
      await this.businessContext.assertBusinessActive(order.businessId);
    }

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

  async getOrdersByBooking(bookingId: string, businessIds?: string[]): Promise<Order[]> {
    // ← FIXED (multi-tenancy — orders gap fix) — previously no scoping at
    // all: any customer or staff member could view any orders tied to any
    // booking on the platform.
    const qb = this.orderRepository.createQueryBuilder('o')
      .where('o."bookingId" = :bookingId', { bookingId })
      .orderBy('o."createdAt"', 'DESC');
    if (businessIds !== undefined) {
      if (!businessIds.length) return [];
      qb.andWhere('o."businessId" IN (:...businessIds)', { businessIds });
    }
    return qb.getMany();
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

  // ← CHANGED (multi-tenancy): businessIds replaces the old `owned`
  // (OwnedResourceIds) polymorphic-join parameter. Now that bookings/orders
  // carry a direct businessId column, scoping is a plain equality/IN check
  // instead of a per-booking-type join. undefined = no restriction (super
  // admin); [] = restrict to nothing; non-empty = restrict to those ids.
  async getAllOrders(
    limit = 50, offset = 0, bookingTypes?: string[],
    businessIds?: string[],
    startDate?: string, endDate?: string,
  ): Promise<{ orders: Order[]; total: number }> {
    if (businessIds && businessIds.length === 0) {
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

    if (!businessIds && bookingTypes && bookingTypes.length === 0) {
      return { orders: [], total: 0 };
    }
    if (!businessIds && bookingTypes) {
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

    if (businessIds) {
      qb.andWhere('order."businessId" IN (:...businessIds)', { businessIds });
    }

    const [orders, total] = await qb.getManyAndCount();
    return { orders, total };
  }

  // Live orders dashboard was previously completely unscoped — any admin
  // could see every non-completed order on the entire platform, across
  // every business. Now scoped directly by businessId.
  async getLiveOrders(
    bookingTypes?: string[],
    businessIds?: string[],
  ): Promise<Order[]> {
    if (businessIds && businessIds.length === 0) return [];
    if (!businessIds && bookingTypes && bookingTypes.length === 0) return [];

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.booking', 'booking')
      .where('order.status NOT IN (:...statuses)', {
        statuses: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.SERVED],
      })
      .orderBy('order.createdAt', 'ASC');

    if (!businessIds && bookingTypes) {
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

    if (businessIds) {
      qb.andWhere('order."businessId" IN (:...businessIds)', { businessIds });
    }

    return qb.getMany();
  }

  async assignOrderToWaiter(
    orderId: string, waiterId: string, managerId: string, ipAddress: string,
    businessIds?: string[], // ← NEW (multi-tenancy — orders gap fix)
  ): Promise<Order> {
    const order = await this.getOrder(orderId);
    // ← FIXED (multi-tenancy — orders gap fix) — previously NO ownership
    // check: a manager from any business could assign a waiter to any
    // other business's order.
    if (businessIds !== undefined) {
      const orderBusinessId = (order as any).businessId;
      if (!businessIds.length || !orderBusinessId || !businessIds.includes(orderBusinessId)) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
    }
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
    businessIds?: string[], // ← NEW (multi-tenancy — orders gap fix)
  ): Promise<Order> {
    const order     = await this.getOrder(orderId);

    // ← FIXED (multi-tenancy — orders gap fix) — previously NO ownership
    // check at all: any staff member from ANY business could update the
    // status of ANY business's order platform-wide.
    if (businessIds !== undefined) {
      const orderBusinessId = (order as any).businessId;
      if (!businessIds.length || !orderBusinessId || !businessIds.includes(orderBusinessId)) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
    }

    // ← NEW (multi-tenancy) — freeze order state transitions while the
    // order's business is suspended (PRD section 5.4).
    await this.businessContext.assertBusinessActive((order as any).businessId);

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