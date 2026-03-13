import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { ApartmentListing } from '../../shared/entities/apartment-listing.entity';
import { ApartmentsService } from './apartments.service';
import { ApartmentListingsService } from './apartments-listings.services';
import { ApartmentsController } from './apartments.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, ApartmentListing]),
    AuditModule,
  ],
  providers: [ApartmentsService, ApartmentListingsService],
  controllers: [ApartmentsController],
  exports: [ApartmentsService, ApartmentListingsService],
})
export class ApartmentsModule {}