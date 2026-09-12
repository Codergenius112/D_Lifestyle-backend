import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { AuditModule } from '../audit/audit.module';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy — tables gap fix)

@Module({
  imports: [TypeOrmModule.forFeature([Booking, TableListing, PlatformSettings]), AuditModule],
  providers: [TablesService, BusinessContextService], // ← CHANGED (multi-tenancy — tables gap fix)
  controllers: [TablesController],
  exports: [TablesService],
})
export class TablesModule {}
