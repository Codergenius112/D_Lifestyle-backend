import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { GroupBooking } from '../../shared/entities/group-booking.entity';
import { BookingService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, GroupBooking]), AuditModule],
  providers: [BookingService],
  controllers: [BookingsController],
  exports: [BookingService],
})
export class BookingsModule {}