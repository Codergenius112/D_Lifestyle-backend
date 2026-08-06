import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User }    from '../../shared/entities/user.entity';
import { Booking } from '../../shared/entities/booking.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
import { Venue } from '../../shared/entities/venue.entity';
import { BookingsModule }      from '../bookings/bookings.module';
import { OrdersModule }        from '../orders/orders.module';
import { PaymentsModule }      from '../payments/payments.module';
import { AnalyticsModule }     from '../analytics/analytics.module';
import { AuditModule }         from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AdminService }             from './admin.service';
import { AdminBookingsController }  from './admin-bookings.controller';
import { AdminOrdersController }    from './admin-orders.controller';
import { AdminStaffController }     from './admin-staff.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Booking, TableListing, Venue]),
    BookingsModule,
    OrdersModule,
    PaymentsModule,
    InventoryModule,
    AnalyticsModule,                           // ← NEW
    AuditModule,
    NotificationsModule,
  ],
  providers:   [AdminService],
  controllers: [
    AdminBookingsController,
    AdminOrdersController,
    AdminStaffController,
  ],
  exports: [AdminService],
})
export class AdminModule {}