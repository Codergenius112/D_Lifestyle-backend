import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { CarListing } from '../../shared/entities/car-listing.entity';
import { CarsService } from './cars.service';
import { CarListingsService } from './car-listings.service';
import { CarsController } from './cars.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, CarListing]),
    AuditModule,
  ],
  providers: [CarsService, CarListingsService],
  controllers: [CarsController],
  exports: [CarsService, CarListingsService],
})
export class CarsModule {}