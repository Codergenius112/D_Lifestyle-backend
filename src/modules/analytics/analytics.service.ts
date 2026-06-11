import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { Order } from '../../shared/entities/order.entity';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { BookingStatus, OrderStatus, PaymentStatus } from '../../shared/enums';

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

  async getDashboardMetrics(startDate: Date, endDate: Date) {
    const bookings = await this.bookingRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    const orders = await this.orderRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

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

  async getBookingAnalytics(startDate: Date, endDate: Date) {
    const bookings = await this.bookingRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

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

  async getRevenueAnalytics(startDate: Date, endDate: Date) {
    const bookings = await this.bookingRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

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

  async getStaffPerformance(startDate: Date, endDate: Date) {
    const orders = await this.orderRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    const byWaiter: Record<string, { completed: number; total: number }> = {};
    for (const o of orders) {
      const key = o.assignedToUserId ?? 'unassigned';
      if (!byWaiter[key]) byWaiter[key] = { completed: 0, total: 0 };
      byWaiter[key].total++;
      if (o.status === OrderStatus.COMPLETED) byWaiter[key].completed++;
    }

    return { period: { startDate, endDate }, byWaiter };
  }

  async getOrderAnalytics(startDate: Date, endDate: Date) {
    const orders = await this.orderRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    return { period: { startDate, endDate }, total: orders.length, byStatus };
  }
}