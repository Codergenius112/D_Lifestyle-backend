import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { BookingStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notifications.service';

@Injectable()
export class LateArrivalService {
  private readonly maxLatePrompts = 3;

  // How many minutes PAST the booking start time before we flag as late
  private readonly lateArrivalThresholdMinutes = parseInt(
    process.env.LATE_ARRIVAL_THRESHOLD_MINUTES || '30',
  );

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async checkAndHandleLateArrivals(): Promise<void> {
    const now = new Date();

    // Threshold: now minus grace period
    // e.g. if threshold is 30min, we look for bookings whose start time
    // was more than 30 minutes ago and the user still hasn't checked in.
    const thresholdTime = new Date(
      now.getTime() - this.lateArrivalThresholdMinutes * 60_000,
    );

    // ✅ FIX: Use `expiresAt` (the booking's scheduled start time) NOT `createdAt`.
    // A booking created 2 hours before an event should NOT be flagged immediately.
    // We only flag it if the scheduled time has passed the threshold.
    const lateBookings = await this.bookingRepository.find({
      where: {
        status:      BookingStatus.CONFIRMED,
        checkInTime: IsNull(),
        expiresAt:   Not(IsNull()),          // must have a scheduled time set
      },
    });

    // Filter in-memory: expiresAt < thresholdTime (booking start has passed grace period)
    const actuallyLate = lateBookings.filter(
      (b) => b.expiresAt && b.expiresAt < thresholdTime,
    );

    for (const booking of actuallyLate) {
      await this.handleLateBooking(booking);
    }
  }

  private async handleLateBooking(booking: Booking): Promise<void> {
    const latePromptCount = (booking.metadata?.latePromptCount || 0) + 1;

    if (latePromptCount >= this.maxLatePrompts) {
      // Auto-cancel after max prompts reached
      booking.status      = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      booking.metadata    = {
        ...booking.metadata,
        autoCancelledDueToLateArrival: true,
        cancelledAt: new Date().toISOString(),
      };

      await this.bookingRepository.save(booking);

      await this.notificationService.sendNotification(
        booking.userId,
        'Booking Cancelled',
        `Your booking has been automatically cancelled due to late arrival.`,
      );

      await this.auditService.logAction({
        actionType:   AuditActionType.BOOKING_UPDATED,
        resourceType: 'booking',
        resourceId:   booking.id,
        changes: { status: 'CANCELLED_AUTO', reason: 'late_arrival_3_prompts' },
      });
    } else {
      // Send prompt and increment counter
      booking.metadata = { ...booking.metadata, latePromptCount };
      await this.bookingRepository.save(booking);

      const minutesLate = Math.round(
        (Date.now() - new Date(booking.expiresAt).getTime()) / 60_000,
      );

      await this.notificationService.sendNotification(
        booking.userId,
        'Late Arrival Notice',
        `You are ${minutesLate} minute(s) late for your booking. ` +
        `Please proceed to the venue. ` +
        `(Prompt ${latePromptCount}/${this.maxLatePrompts})`,
      );

      await this.auditService.logAction({
        actionType:   AuditActionType.BOOKING_UPDATED,
        resourceType: 'booking',
        resourceId:   booking.id,
        changes: { latePromptCount, minutesLate },
      });
    }
  }

  async extendLateArrivalDeadline(
    bookingId: string,
    extensionMinutes = 15,
  ): Promise<void> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) return;

    // Push the scheduled start time forward by the extension
    if (booking.expiresAt) {
      booking.expiresAt = new Date(
        booking.expiresAt.getTime() + extensionMinutes * 60_000,
      );
    }

    booking.metadata = {
      ...booking.metadata,
      lastExtensionTime:   new Date().toISOString(),
      deadlineExtendedBy:  extensionMinutes,
    };

    await this.bookingRepository.save(booking);
  }
}