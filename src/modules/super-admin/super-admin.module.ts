import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User }            from '../../shared/entities/user.entity';
import { Booking }         from '../../shared/entities/booking.entity';
import { FinancialLedger } from '../../shared/entities/financial-ledger.entity';
import { AuditLog }        from '../../shared/entities/audit-log.entity';
import { SuperAdminService }      from './super-admin.service';
import { SuperAdminController }   from './super-admin.controller';
import { AuditModule }            from '../audit/audit.module';
import { AnalyticsModule }        from '../analytics/analytics.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Booking, FinancialLedger, AuditLog]),
    AuditModule,
    AnalyticsModule,
    PlatformSettingsModule,
  ],
  providers:   [SuperAdminService],
  controllers: [SuperAdminController],
  exports:     [SuperAdminService],
})
export class SuperAdminModule {}