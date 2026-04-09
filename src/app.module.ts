import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { dataSourceOptions } from './database/data-source';
import { StringValue } from 'ms';

// Controllers
import { AuthController }           from './modules/auth/auth.controller';
import { BookingsController }       from './modules/bookings/bookings.controller';
import { PaymentsController }       from './modules/payments/payments.controller';
import { PaystackWebhookController } from './modules/payments/paystack-webhook.controller';
import { WalletController }         from './modules/payments/wallet.controller';
import { OrdersController }         from './modules/orders/orders.controller';
import { MenuController }           from './modules/orders/menu.controller';
import { QueuesController }         from './modules/queues/queues.controller';
import { TicketsController }        from './modules/tickets/tickets.controller';
import { TablesController }         from './modules/tables/tables.controller';
import { ApartmentsController }     from './modules/apartments/apartments.controller';
import { CarsController }           from './modules/cars/cars.controller';
import { EventsController }         from './modules/events/events.controller';
import { NotificationsController }  from './modules/notifications/notifications.controller';
import { AdminBookingsController }  from './modules/admin/admin-bookings.controller';
import { AdminOrdersController }    from './modules/admin/admin-orders.controller';
import { AdminStaffController }     from './modules/admin/admin-staff.controller';
import { AdminAnalyticsController } from './modules/admin/admin-analytics.controller';
import { AuditController }          from './modules/audit/audit.controller';

// Services
import { AuthService }                  from './modules/auth/auth.service';
import { JwtStrategy }                  from './modules/auth/jwt.strategy';
import { BookingService }               from './modules/bookings/bookings.service';
import { LateArrivalService }           from './modules/bookings/late-arrival.service';
import { GroupBookingCountdownService } from './modules/bookings/group-booking-countdown.service';
import { BookingSchedulerService }      from './modules/bookings/booking-scheduler.service';
import { PaymentService }               from './modules/payments/payments.service';
import { WalletService }                from './modules/payments/wallet.service';
import { OrderService }                 from './modules/orders/orders.service';
import { MenuService }                  from './modules/orders/menu.service';
import { QueuesService }                from './modules/queues/queues.service';
import { TicketsService }               from './modules/tickets/tickets.service';
import { TablesService }                from './modules/tables/tables.service';
import { ApartmentsService }            from './modules/apartments/apartments.service';
import { ApartmentListingsService }     from './modules/apartments/apartments-listings.services';
import { CarsService }                  from './modules/cars/cars.service';
import { CarListingsService }           from './modules/cars/car-listings.service';
import { EventsService }                from './modules/events/events.service';
import { AuditService }                 from './modules/audit/audit.service';
import { NotificationService }          from './modules/notifications/notifications.service';
import { NotificationProcessor }        from './modules/notifications/notification.processor';
import { AnalyticsService }             from './modules/analytics/analytics.service';
import { PricingService }               from './shared/services/pricing.service';
import { ValidationService }            from './shared/services/validation.service';

// Guards / Filters / Interceptors
import { JwtAuthGuard }        from './common/guards/jwt-auth.guard';
import { RolesGuard }          from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

// Entities
import {
  User, Booking, PaymentTransaction, Wallet, Order,
  AuditLog, FinancialLedger, Queue, GroupBooking,
} from './shared/entities';
import { ApartmentListing } from './shared/entities/apartment-listing.entity';
import { CarListing }       from './shared/entities/car-listing.entity';
import { TableListing }     from './shared/entities/table-listing.entity';
import { MenuItem }         from './shared/entities/menu-item.entity';
import { Event }            from './shared/entities/event.entity';  
import { DeviceToken }      from './shared/entities/device-token.entity';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([
      User, Booking, PaymentTransaction, Wallet, Order,
      AuditLog, FinancialLedger, Queue, GroupBooking,
      ApartmentListing, CarListing,
      TableListing,
      MenuItem,
      Event,
      DeviceToken,
      ]),

    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: (process.env.JWT_EXPIRATION || '3600s') as StringValue },
    }),

    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: 'notifications' }),
    ScheduleModule.forRoot(),
  ],

  controllers: [
    AuthController,
    BookingsController,
    PaymentsController,
    PaystackWebhookController,
    WalletController,
    OrdersController,
    MenuController,        
    QueuesController,
    TicketsController,
    TablesController,
    ApartmentsController,
    CarsController,
    EventsController,
    NotificationsController,
    AdminBookingsController,
    AdminOrdersController,
    AdminStaffController,
    AdminAnalyticsController,
    AuditController,
  ],

  providers: [
    AuthService, JwtStrategy,
    BookingService, LateArrivalService, GroupBookingCountdownService, BookingSchedulerService,
    PaymentService, WalletService,
    OrderService, MenuService, 
    QueuesService,
    TicketsService,
    TablesService,
    ApartmentsService, ApartmentListingsService,
    CarsService, CarListingsService,
    EventsService,
    AuditService,
    NotificationService, NotificationProcessor,
    AnalyticsService,
    PricingService, ValidationService,
    JwtAuthGuard, RolesGuard,
    ResponseInterceptor, HttpExceptionFilter,
  ],
})
export class AppModule {}