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
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const orders = await this.orderRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(
      (b) => b.status === BookingStatus.CONFIRMED,
    ).length;
    const cancelledBookings = bookings.filter(
      (b) => b.status === BookingStatus.CANCELLED,
    ).length;
    const conversionRate = (confirmedBookings / totalBookings) * 100 || 0;

    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.basePrice), 0);
    const platformCommission = bookings.reduce(
      (sum, b) => sum + Number(b.platformCommission),
      0,
    );
    const venueRevenue = totalRevenue - platformCommission;

    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === OrderStatus.COMPLETED).length;
    const averageOrderValue =
      orders.length > 0
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
        completionRate:
          totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(2) + '%' : '0%',
        averageValue: averageOrderValue.toFixed(2),
      },
    };
  }

  async getBookingAnalytics(startDate: Date, endDate: Date) {
    const bookings = await this.bookingRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const byStatus = {
      confirmed: bookings.filter((b) => b.status === BookingStatus.CONFIRMED).length,
      cancelled: bookings.filter((b) => b.status === BookingStatus.CANCELLED).length,
      pending: bookings.filter(
        (b) =>
          b.status === BookingStatus.PENDING_PAYMENT ||
          b.status === BookingStatus.PENDING_GROUP_PAYMENT,
      ).length,
      completed: bookings.filter((b) => b.status === BookingStatus.COMPLETED).length,
    };

    const byType = bookings.reduce(
      (acc, b) => {
        acc[b.bookingType] = (acc[b.bookingType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const avgBookingValue =
      bookings.length > 0
        ? bookings.reduce((sum, b) => sum + Number(b.basePrice), 0) / bookings.length
        : 0;

    return {
      totalBookings: bookings.length,
      byStatus,
      byType,
      averageBookingValue: avgBookingValue.toFixed(2),
    };
  }

  async getRevenueAnalytics(startDate: Date, endDate: Date) {
    const bookings = await this.bookingRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        paymentStatus: PaymentStatus.FULLY_PAID,
      },
    });

    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.basePrice), 0);
    const platformCommission = bookings.reduce(
      (sum, b) => sum + Number(b.platformCommission),
      0,
    );
    const serviceChargeRevenue = bookings.reduce(
      (sum, b) => sum + Number(b.serviceCharge),
      0,
    );
    const venueRevenue = totalRevenue - platformCommission;

    return {
      totalRevenue: totalRevenue.toFixed(2),
      platformCommission: platformCommission.toFixed(2),
      serviceChargeRevenue: serviceChargeRevenue.toFixed(2),
      venueRevenue: venueRevenue.toFixed(2),
      bookingCount: bookings.length,
      averageBookingValue: bookings.length > 0 ? (totalRevenue / bookings.length).toFixed(2) : '0',
    };
  }

  async getOrderAnalytics(startDate: Date, endDate: Date) {
    const orders = await this.orderRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const completedOrders = orders.filter((o) => o.status === OrderStatus.COMPLETED);
    const cancelledOrders = orders.filter((o) => o.status === OrderStatus.CANCELLED);
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const completedRevenue = completedOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    return {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      completionRate:
        orders.length > 0 ? ((completedOrders.length / orders.length) * 100).toFixed(2) : '0',
      totalRevenue: totalRevenue.toFixed(2),
      completedRevenue: completedRevenue.toFixed(2),
      averageOrderValue:
        orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0',
      averageCompletedOrderValue:
        completedOrders.length > 0
          ? (completedRevenue / completedOrders.length).toFixed(2)
          : '0',
    };
  }

  async getStaffPerformance(startDate: Date, endDate: Date) {
    const orders = await this.orderRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const staffMetrics = orders.reduce(
      (acc, order) => {
        if (order.assignedToUserId) {
          if (!acc[order.assignedToUserId]) {
            acc[order.assignedToUserId] = {
              staffId: order.assignedToUserId,
              totalOrders: 0,
              completedOrders: 0,
              cancelledOrders: 0,
              totalRevenue: 0,
            };
          }
          acc[order.assignedToUserId].totalOrders++;
          acc[order.assignedToUserId].totalRevenue += Number(order.totalAmount);

          if (order.status === OrderStatus.COMPLETED) {
            acc[order.assignedToUserId].completedOrders++;
          } else if (order.status === OrderStatus.CANCELLED) {
            acc[order.assignedToUserId].cancelledOrders++;
          }
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    return Object.values(staffMetrics).map((metric: any) => ({
      ...metric,
      completionRate:
        metric.totalOrders > 0
          ? ((metric.completedOrders / metric.totalOrders) * 100).toFixed(2) + '%'
          : '0%',
      averageOrderValue:
        metric.totalOrders > 0 ? (metric.totalRevenue / metric.totalOrders).toFixed(2) : '0',
    }));
  }
}
