import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { dataSourceOptions } from './database/data-source';

// ============================================================================
// CONTROLLERS
// ============================================================================
import { AuthController } from './modules/auth/auth.controller';
//import { BookingController } from './modules/bookings/booking.controller';
import { BookingController } from '/src/modules/bookings/booking.controller';
import { PaymentController } from './modules/payments/payment.controller';
import { OrderController } from './modules/orders/order.controller';
import { QueueController } from './modules/queues/queue.controller';
import { AdminBookingsController } from './modules/admin/admin-bookings.controller';
import { AdminOrdersController } from './modules/admin/admin-orders.controller';
import { AdminStaffController } from './modules/admin/admin-staff.controller';
import { AdminAnalyticsController } from './modules/admin/admin-analytics.controller';
import { AuditController } from './modules/audit/audit.controller';

// ============================================================================
// EXISTING SERVICES
// ============================================================================
import { AuthService } from './modules/auth/auth.service';
import { JwtStrategy } from './modules/auth/jwt.strategy';
import { BookingService } from './modules/bookings/booking.service';
import { PaymentService } from './modules/payments/payment.service';
import { OrderService } from './modules/orders/order.service';
import { AuditService } from './modules/audit/audit.service';

// ============================================================================
// PHASE 4 - NEW SERVICES (Late Arrival, Group Booking, Wallet, Queue, etc.)
// ============================================================================
import { LateArrivalService } from './modules/bookings/late-arrival.service';
import { GroupBookingCountdownService } from './modules/bookings/group-booking-countdown.service';
import { WalletService } from './modules/payments/wallet.service';
import { QueueService } from './modules/queues/queue.service';
import { NotificationService } from './modules/notifications/notification.service';
import { NotificationProcessor } from './modules/notifications/notification.processor';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { BookingSchedulerService } from './modules/bookings/booking-scheduler.service';

// ============================================================================
// SHARED UTILITY SERVICES
// ============================================================================
import { PricingService } from './shared/services/pricing.service';
import { ValidationService } from './shared/services/validation.service';

// ============================================================================
// GUARDS
// ============================================================================
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// ============================================================================
// FILTERS & INTERCEPTORS
// ============================================================================
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

// ============================================================================
// ENTITIES
// ============================================================================
import {
  User,
  Booking,
  PaymentTransaction,
  Wallet,
  Order,
  AuditLog,
  FinancialLedger,
  Queue,
  GroupBooking,
} from '../src/modules/shared/entities';

@Module({
  imports: [
    // ========================================================================
    // CONFIGURATION MODULES
    // ========================================================================
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ========================================================================
    // DATABASE & ORM
    // ========================================================================
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([
      User,
      Booking,
      PaymentTransaction,
      Wallet,
      Order,
      AuditLog,
      FinancialLedger,
      Queue,
      GroupBooking,
    ]),

    // ========================================================================
    // AUTHENTICATION & JWT
    // ========================================================================
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: process.env.JWT_EXPIRATION || '3600s' },
    }),

    // ========================================================================
    // MESSAGE QUEUE & JOB PROCESSING (for notifications)
    // ========================================================================
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),

    // ========================================================================
    // SCHEDULED TASKS & CRON JOBS
    // ========================================================================
    ScheduleModule.forRoot(),
  ],

  controllers: [
    // ========================================================================
    // EXISTING CONTROLLERS
    // ========================================================================
    AuthController,
    BookingController,
    PaymentController,
    OrderController,
    QueueController,
    AdminBookingsController,
    AdminOrdersController,
    AdminStaffController,
    AdminAnalyticsController,
    AuditController,
  ],

  providers: [
    // ========================================================================
    // EXISTING CORE SERVICES
    // ========================================================================
    AuthService,
    JwtStrategy,
    BookingService,
    PaymentService,
    OrderService,
    AuditService,

    // ========================================================================
    // PHASE 4 - NEW BUSINESS LOGIC SERVICES
    // ========================================================================
    // Late Arrival & Auto-Cancellation
    LateArrivalService,

    // Group Booking Countdown & Expiration
    GroupBookingCountdownService,

    // Wallet & Balance Management
    WalletService,

    // Queue Management (Position Tracking)
    QueueService,

    // Notifications (Real-time & Async)
    NotificationService,
    NotificationProcessor,

    // Analytics & Reporting
    AnalyticsService,

    // Scheduled Jobs & Cron Tasks
    BookingSchedulerService,

    // ========================================================================
    // SHARED UTILITY SERVICES
    // ========================================================================
    // Pricing & Commission Calculations
    PricingService,

    // Validation & Business Rules
    ValidationService,

    // ========================================================================
    // GUARDS
    // ========================================================================
    JwtAuthGuard,
    RolesGuard,

    // ========================================================================
    // FILTERS & INTERCEPTORS
    // ========================================================================
    ResponseInterceptor,
    HttpExceptionFilter,
  ],
})
export class AppModule {}