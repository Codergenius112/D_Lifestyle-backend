import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [BookingsModule, OrdersModule, PaymentsModule, AnalyticsModule, AuditModule],
})
export class AdminModule {}
