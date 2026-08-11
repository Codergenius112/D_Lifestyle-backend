import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Brackets } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { Order } from '../../shared/entities/order.entity';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { BookingStatus, OrderStatus, BookingType } from '../../shared/enums';
import type { OwnedResourceIds } from '../../shared/services/ownership-resolver.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(PaymentTransaction)
    private paymentRepository: Repository<PaymentTransaction>,
  ) {}

  // bookingTypes: undefined = no restriction (super admin). [] = restrict to
  // nothing. owned: precise per-owner resource ids, layered on top of the
  // category check — omit for super admin (no restriction).
  async getDashboardMetrics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], owned?: OwnedResourceIds) {
    const bookings = await this.scopedBookings(startDate, endDate, bookingTypes, owned);
    const orders   = await this.scopedOrders(startDate, endDate, bookingTypes, owned);

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

  async getBookingAnalytics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], owned?: OwnedResourceIds) {
    const bookings = await this.scopedBookings(startDate, endDate, bookingTypes, owned);

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

  async getRevenueAnalytics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], owned?: OwnedResourceIds) {
    const bookings = await this.scopedBookings(startDate, endDate, bookingTypes, owned);

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

  async getStaffPerformance(startDate: Date, endDate: Date, bookingTypes?: BookingType[], owned?: OwnedResourceIds) {
    const orders = await this.scopedOrders(startDate, endDate, bookingTypes, owned);

    const byWaiter: Record<string, { completed: number; total: number }> = {};
    for (const o of orders) {
      const key = o.assignedToUserId ?? 'unassigned';
      if (!byWaiter[key]) byWaiter[key] = { completed: 0, total: 0 };
      byWaiter[key].total++;
      if (o.status === OrderStatus.COMPLETED) byWaiter[key].completed++;
    }

    return { period: { startDate, endDate }, byWaiter };
  }

  async getOrderAnalytics(startDate: Date, endDate: Date, bookingTypes?: BookingType[], owned?: OwnedResourceIds) {
    const orders = await this.scopedOrders(startDate, endDate, bookingTypes, owned);

    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    return { period: { startDate, endDate }, total: orders.length, byStatus };
  }

  // Category-level scoping (bookingTypes) says "this business does
  // table/club work"; owned (if provided) narrows further to only that
  // specific owner's resources.
  private async scopedBookings(startDate: Date, endDate: Date, bookingTypes?: BookingType[], owned?: OwnedResourceIds) {
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .where('b."createdAt" BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (bookingTypes) {
      qb.andWhere('b."bookingType" IN (:...types)', { types: bookingTypes.length ? bookingTypes : ['__none__'] });
    }

    if (owned) {
      qb.andWhere(new Brackets((sub) => {
        let addedAny = false;
        const add = (clause: string, params: any) => {
          addedAny ? sub.orWhere(clause, params) : sub.where(clause, params);
          addedAny = true;
        };
        if (owned.tableListingIds.length) {
          add('(b."bookingType" = :ttype AND b."resourceId" IN (:...tIds))',
            { ttype: BookingType.TABLE, tIds: owned.tableListingIds });
        }
        if (owned.apartmentListingIds.length) {
          add('(b."bookingType" = :atype AND b."resourceId" IN (:...aIds))',
            { atype: BookingType.APARTMENT, aIds: owned.apartmentListingIds });
        }
        if (owned.carListingIds.length) {
          add('(b."bookingType" = :ctype AND b."resourceId" IN (:...cIds))',
            { ctype: BookingType.CAR, cIds: owned.carListingIds });
        }
        if (owned.eventIds.length) {
          add('(b."bookingType" = :ktype AND b."resourceId" IN (:...eIds))',
            { ktype: BookingType.TICKET, eIds: owned.eventIds });
        }
        if (!addedAny) sub.where('1 = 0');
      }));
    }

    return qb.getMany();
  }

  // Orders don't always carry a bookingType directly — manual purchases can
  // be tied to a venue or event with no booking at all. Venue-only
  // purchases are table/club business; event-only purchases are ticketing.
  private async scopedOrders(startDate: Date, endDate: Date, bookingTypes?: BookingType[], owned?: OwnedResourceIds) {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoin('bookings', 'b', 'b.id = o."bookingId"')
      .where('o."createdAt" BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (bookingTypes) {
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

    if (owned) {
      qb.andWhere(new Brackets((sub) => {
        let addedAny = false;
        const add = (clause: string, params: any) => {
          addedAny ? sub.orWhere(clause, params) : sub.where(clause, params);
          addedAny = true;
        };
        if (owned.tableListingIds.length) {
          add('(b."bookingType" = :ttype AND b."resourceId" IN (:...tIds))',
            { ttype: BookingType.TABLE, tIds: owned.tableListingIds });
        }
        if (owned.apartmentListingIds.length) {
          add('(b."bookingType" = :atype AND b."resourceId" IN (:...aIds))',
            { atype: BookingType.APARTMENT, aIds: owned.apartmentListingIds });
        }
        if (owned.carListingIds.length) {
          add('(b."bookingType" = :ctype AND b."resourceId" IN (:...cIds))',
            { ctype: BookingType.CAR, cIds: owned.carListingIds });
        }
        if (owned.eventIds.length) {
          add('((b."bookingType" = :ktype AND b."resourceId" IN (:...eIds)) OR o."eventId" IN (:...eIds))',
            { ktype: BookingType.TICKET, eIds: owned.eventIds });
        }
        if (owned.venueIds.length) {
          add('o."venueId" IN (:...vIds)', { vIds: owned.venueIds });
        }
        if (!addedAny) sub.where('1 = 0');
      }));
    }

    return qb.getMany();
  }
}
