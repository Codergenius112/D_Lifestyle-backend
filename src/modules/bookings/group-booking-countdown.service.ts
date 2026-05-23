import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { GroupBooking } from '../../shared/entities/group-booking.entity';
import { Booking } from '../../shared/entities/booking.entity';
import { BookingStatus, PaymentStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notifications.service';

@Injectable()
export class GroupBookingCountdownService {
  constructor(
    @InjectRepository(GroupBooking)
    private groupBookingRepository: Repository<GroupBooking>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async checkAndExpireGroupBookings(): Promise<void> {
    const now = new Date();

    // Find pending group bookings that have expired
    const expiredGroupBookings = await this.groupBookingRepository.find({
      where: {
        countdownExpiresAt: LessThan(now),
      },
    });

    for (const groupBooking of expiredGroupBookings) {
      await this.expireGroupBooking(groupBooking);
    }
  }

  private async expireGroupBooking(groupBooking: GroupBooking): Promise<void> {
    const booking = await this.bookingRepository.findOne({
      where: { id: groupBooking.bookingId },
    });

    if (booking) {
      // Check if full payment was received
      if (groupBooking.totalPaid < groupBooking.totalRequired) {
        // Expire the booking
        booking.status = BookingStatus.EXPIRED;
        booking.expiresAt = new Date();
        booking.paymentStatus = PaymentStatus.UNPAID;

        await this.bookingRepository.save(booking);

        // Notify all participants
        for (const participantId of groupBooking.participantIds) {
          await this.notificationService.sendNotification(
            participantId,
            'Group Booking Expired',
            `Group booking has expired. Full payment was not received in time.`,
          );
        }

        // Audit log
        await this.auditService.logAction({
          actionType: AuditActionType.BOOKING_UPDATED,
          resourceType: 'booking',
          resourceId: booking.id,
          changes: {
            status: BookingStatus.EXPIRED,
            reason: 'group_booking_countdown_expired',
          },
        });
      } else {
        // Full payment received, confirm the booking
        booking.status = BookingStatus.CONFIRMED;
        booking.paymentStatus = PaymentStatus.FULLY_PAID;

        await this.bookingRepository.save(booking);

        // Notify all participants
        for (const participantId of groupBooking.participantIds) {
          await this.notificationService.sendNotification(
            participantId,
            'Group Booking Confirmed',
            `Group booking has been confirmed!`,
          );
        }
      }
    }
  }

  async getGroupBookingStatus(groupBookingId: string) {
    const groupBooking = await this.groupBookingRepository.findOne({
      where: { id: groupBookingId },
    });

    if (!groupBooking) {
      return null;
    }

    const timeRemaining = groupBooking.countdownExpiresAt.getTime() - Date.now();
    const minutesRemaining = Math.ceil(timeRemaining / 60000);

    return {
      groupBookingId,
      totalRequired: groupBooking.totalRequired,
      totalPaid: groupBooking.totalPaid,
      minutesRemaining,
      percentagePaid: (groupBooking.totalPaid / groupBooking.totalRequired) * 100,
      contributors: groupBooking.contributionTracker,
    };
  }
}
