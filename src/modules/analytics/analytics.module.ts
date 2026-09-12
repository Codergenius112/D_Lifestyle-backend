import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { Order } from '../../shared/entities/order.entity';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← CHANGED (multi-tenancy)

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Order, PaymentTransaction])],
  providers: [AnalyticsService, BusinessContextService], // ← CHANGED (multi-tenancy)
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
