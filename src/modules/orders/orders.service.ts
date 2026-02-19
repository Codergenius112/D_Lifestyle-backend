import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../shared/entities/order.entity';
import { OrderStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';


@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private auditService: AuditService,
  ) {}

  async createOrder(
    bookingId: string,
    userId: string,
    items: any[],
    ipAddress: string,
  ): Promise<Order> {
    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = new Order();
    order.bookingId = bookingId;
    order.userId = userId;
    order.items = items;
    order.totalAmount = totalAmount;
    order.status = OrderStatus.CREATED;

    const savedOrder = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType: AuditActionType.ORDER_CREATED,
      actorId: userId,
      resourceType: 'order',
      resourceId: savedOrder.id,
      changes: { itemCount: items.length, total: totalAmount },
      ipAddress,
    });

    return savedOrder;
  }

  async assignOrderToWaiter(
    orderId: string,
    waiterId: string,
    managerId: string,
    ipAddress: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    order.assignedToUserId = waiterId;
    order.status = OrderStatus.ASSIGNED;

    const updated = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType: AuditActionType.ORDER_ASSIGNED,
      actorId: managerId,
      resourceType: 'order',
      resourceId: orderId,
      changes: { assignedTo: waiterId },
      ipAddress,
    });

    return updated;
  }

  async routeOrderToStation(
    orderId: string,
    stationId: string,
    managerId: string,
    ipAddress: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    order.routedToStationId = stationId;
    order.status = OrderStatus.ROUTED;

    const updated = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType: AuditActionType.ORDER_ASSIGNED,
      actorId: managerId,
      resourceType: 'order',
      resourceId: orderId,
      changes: { routedTo: stationId },
      ipAddress,
    });

    return updated;
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    ipAddress: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const oldStatus = order.status;
    order.status = newStatus;

    if (newStatus === OrderStatus.READY) {
      order.readyAt = new Date();
    } else if (newStatus === OrderStatus.SERVED) {
      order.servedAt = new Date();
    } else if (newStatus === OrderStatus.COMPLETED) {
      order.completedAt = new Date();
    }

    const updated = await this.orderRepository.save(order);

    await this.auditService.logAction({
      actionType: AuditActionType.ORDER_COMPLETED,
      actorId: userId,
      resourceType: 'order',
      resourceId: orderId,
      changes: { status: { from: oldStatus, to: newStatus } },
      ipAddress,
    });

    return updated;
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
}