import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { BookingStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notifications.service';


@Injectable()
export class LateArrivalService {
  private maxLatePrompts = 3;
  private lateArrivalThresholdMinutes = parseInt(
    process.env.LATE_ARRIVAL_THRESHOLD_MINUTES || '15',
  );

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async checkAndHandleLateArrivals(): Promise<void> {
    // Find confirmed bookings that should have checked in
    const now = new Date();
    const thresholdTime = new Date(now.getTime() - this.lateArrivalThresholdMinutes * 60000);

    const lateBookings = await this.bookingRepository.find({
      where: {
        status: BookingStatus.CONFIRMED,
        createdAt: LessThan(thresholdTime),
        checkInTime: IsNull(),
      },
    });

    for (const booking of lateBookings) {
      await this.handleLateBooking(booking);
    }
  }

  private async handleLateBooking(booking: Booking): Promise<void> {
    const latePromptCount = (booking.metadata?.latePromptCount || 0) + 1;

    if (latePromptCount >= this.maxLatePrompts) {
      // Auto-cancel after 3 prompts
      booking.status = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      booking.metadata = { ...booking.metadata, autoCancelledDueToLateArrival: true };

      await this.bookingRepository.save(booking);

      // Send cancellation notification
      await this.notificationService.sendNotification(
        booking.userId,
        'Booking Cancelled',
        `Your booking has been automatically cancelled due to late arrival.`,
      );

      // Log audit
      await this.auditService.logAction({
        actionType: AuditActionType.BOOKING_UPDATED,
        resourceType: 'booking',
        resourceId: booking.id,
        changes: { status: 'CANCELLED_AUTO', reason: 'late_arrival_3_prompts' },
      });
    } else {
      // Send late arrival prompt
      booking.metadata = { ...booking.metadata, latePromptCount };
      await this.bookingRepository.save(booking);

      await this.notificationService.sendNotification(
        booking.userId,
        'Late Arrival Notice',
        `You have not checked in yet. Please proceed to the venue. (Prompt ${latePromptCount}/${this.maxLatePrompts})`,
      );

      await this.auditService.logAction({
        actionType: AuditActionType.BOOKING_UPDATED,
        resourceType: 'booking',
        resourceId: booking.id,
        changes: { latePromptCount },
      });
    }
  }

  async extendLateArrivalDeadline(bookingId: string, extensionMinutes = 15): Promise<void> {
    const booking = await this.bookingRepository.findOne({ where: { id: bookingId } });

    if (booking) {
      booking.metadata = {
        ...booking.metadata,
        lastExtensionTime: new Date(),
        deadlineExtendedBy: extensionMinutes,
      };
      await this.bookingRepository.save(booking);
    }
  }
}