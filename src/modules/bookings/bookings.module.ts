import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking }      from '../../shared/entities/booking.entity';
import { GroupBooking } from '../../shared/entities/group-booking.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { BookingService }               from './bookings.service';
import { BookingsController }           from './bookings.controller';
import { LateArrivalService }           from './late-arrival.service';
import { GroupBookingCountdownService } from './group-booking-countdown.service';
import { BookingSchedulerService }      from './booking-scheduler.service';
import { AuditModule }         from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, GroupBooking, PlatformSettings]),
    AuditModule,
    NotificationsModule,
  ],
  providers: [
    BookingService,
    LateArrivalService,
    GroupBookingCountdownService,
    BookingSchedulerService,
    BusinessContextService, // ← NEW (multi-tenancy)
  ],
  controllers: [BookingsController],
  exports: [BookingService, LateArrivalService, GroupBookingCountdownService],
})
export class BookingsModule {}