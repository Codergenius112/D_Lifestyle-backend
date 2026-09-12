import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Brackets } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { Order } from '../../shared/entities/order.entity';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { BookingStatus, OrderStatus, BookingType, BusinessShareDataType } from '../../shared/enums';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (Phase 5)

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(PaymentTransaction)
    private paymentRepository: Repository<PaymentTransaction>,
    private readonly businessContext: BusinessContextService, // ← NEW (Phase 5)
  ) {}

  // ← NEW (Phase 5) — analytics is read-only by nature (there's no concept
  // of "writing" a dashboard metric), so sharing ANALYTICS just expands the
  // scope for every read below — no Manager-only write check needed here,
  // unlike inventory.
  private expandForAnalytics(businessIds?: string[]): Promise<string[] | undefined> {
    return this.businessContext.resolveReadableBusinessIds(businessIds, BusinessShareDataType.ANALYTICS);
  }

  // ← CHANGED (multi-tenancy): businessIds replaces `owned` (OwnedResourceIds).
  // undefined = no restriction (super admin). [] = restrict to nothing.
  // non-empty = restrict to those business(es) — this is also what lets one
  // owner's several businesses report separately rather than being merged.
  async getDashboardMetrics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], businessIds?: string[]) {
    businessIds = await this.expandForAnalytics(businessIds);
    const bookings = await this.scopedBookings(startDate, endDate, bookingTypes, businessIds);
    const orders   = await this.scopedOrders(startDate, endDate, bookingTypes, businessIds);

    const totalBookings     = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === BookingStatus.CONFIRMED).length;
    const cancelledBookings = bookings.filter(b => b.status === BookingStatus.CANCELLED).length;
    const conversionRate    = (confirmedBookings / totalBookings) * 100 || 0;

    const totalRevenue       = bookings.reduce((sum, b) => sum + Number(b.basePrice), 0);
    const platformCommission = bookings.reduce((sum, b) => sum + Number(b.platformCommission), 0);
    const venueRevenue       = totalRevenue - platformCommission;

    const totalOrders     = orders.length;
    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED).length;
    const averageOrderValue = orders.length > 0
      ? orders.reduce((sum, o) => sum + Number(o.totalAmount), 0) / orders.length
      : 0;

    return {
      period: { startDate, endDate },
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        conversionRate: conversionRate.toFixed(2) + '%',
      },
      revenue: {
        total: totalRevenue.toFixed(2),
        platformCommission: platformCommission.toFixed(2),
        venueRevenue: venueRevenue.toFixed(2),
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        completionRate: totalOrders > 0
          ? ((completedOrders / totalOrders) * 100).toFixed(2) + '%'
          : '0%',
        averageValue: averageOrderValue.toFixed(2),
      },
    };
  }

  async getBookingAnalytics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], businessIds?: string[]) {
    businessIds = await this.expandForAnalytics(businessIds);
    const bookings = await this.scopedBookings(startDate, endDate, bookingTypes, businessIds);

    const byType: Record<string, number>   = {};
    const byStatus: Record<string, number> = {};
    for (const b of bookings) {
      byType[b.bookingType] = (byType[b.bookingType] ?? 0) + 1;
      byStatus[b.status]    = (byStatus[b.status]    ?? 0) + 1;
    }

    return {
      period: { startDate, endDate },
      total: bookings.length,
      byType,
      byStatus,
    };
  }

  async getRevenueAnalytics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], businessIds?: string[]) {
    businessIds = await this.expandForAnalytics(businessIds);
    const bookings = await this.scopedBookings(startDate, endDate, bookingTypes, businessIds);

    const confirmed = bookings.filter(b =>
      [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.ACTIVE].includes(b.status),
    );

    const baseRevenue        = confirmed.reduce((s, b) => s + Number(b.basePrice),          0);
    const serviceCharges     = confirmed.reduce((s, b) => s + Number(b.serviceCharge),      0);
    const platformCommission = confirmed.reduce((s, b) => s + Number(b.platformCommission), 0);

    return {
      period: { startDate, endDate },
      baseRevenue,
      serviceCharges,
      platformCommission,
      total: baseRevenue + serviceCharges,
    };
  }

  async getStaffPerformance(startDate: Date, endDate: Date, bookingTypes?: BookingType[], businessIds?: string[]) {
    businessIds = await this.expandForAnalytics(businessIds);
    const orders = await this.scopedOrders(startDate, endDate, bookingTypes, businessIds);

    const byWaiter: Record<string, { completed: number; total: number }> = {};
    for (const o of orders) {
      const key = o.assignedToUserId ?? 'unassigned';
      if (!byWaiter[key]) byWaiter[key] = { completed: 0, total: 0 };
      byWaiter[key].total++;
      if (o.status === OrderStatus.COMPLETED) byWaiter[key].completed++;
    }

    return { period: { startDate, endDate }, byWaiter };
  }

  async getOrderAnalytics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], businessIds?: string[]) {
    businessIds = await this.expandForAnalytics(businessIds);
    const orders = await this.scopedOrders(startDate, endDate, bookingTypes, businessIds);

    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    return { period: { startDate, endDate }, total: orders.length, byStatus };
  }

  // ← CHANGED (multi-tenancy): a plain businessId IN (...) filter replaces
  // the old polymorphic bookingType+resourceId bracket, now that bookings
  // carry a direct businessId column.
  private async scopedBookings(startDate: Date, endDate: Date, bookingTypes?: BookingType[], businessIds?: string[]) {
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .where('b."createdAt" BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (!businessIds && bookingTypes) {
      qb.andWhere('b."bookingType" IN (:...types)', { types: bookingTypes.length ? bookingTypes : ['__none__'] });
    }

    if (businessIds) {
      if (!businessIds.length) return [];
      qb.andWhere('b."businessId" IN (:...businessIds)', { businessIds });
    }

    return qb.getMany();
  }

  // Orders don't always carry a bookingType directly — manual purchases can
  // be tied to a venue or event with no booking at all. businessId is
  // denormalized directly onto Order regardless of which of the three it
  // came from, so this is a single equality check either way.
  private async scopedOrders(startDate: Date, endDate: Date, bookingTypes?: BookingType[], businessIds?: string[]) {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoin('bookings', 'b', 'b.id = o."bookingId"')
      .where('o."createdAt" BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (!businessIds && bookingTypes) {
      if (!bookingTypes.length) return [];
      qb.andWhere(new Brackets((sub) => {
        sub.where('b."bookingType" IN (:...types)', { types: bookingTypes });
        if (bookingTypes.includes(BookingType.TABLE)) {
          sub.orWhere('o."venueId" IS NOT NULL');
        }
        if (bookingTypes.includes(BookingType.TICKET)) {
          sub.orWhere('o."eventId" IS NOT NULL');
        }
      }));
    }

    if (businessIds) {
      if (!businessIds.length) return [];
      qb.andWhere('o."businessId" IN (:...businessIds)', { businessIds });
    }

    return qb.getMany();
  }
}