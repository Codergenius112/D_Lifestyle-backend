import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { ApartmentsService } from './apartments.service';
import { ApartmentsController } from './apartments.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), AuditModule],
  providers: [ApartmentsService],
  controllers: [ApartmentsController],
  exports: [ApartmentsService],
})
export class ApartmentsModule {}
