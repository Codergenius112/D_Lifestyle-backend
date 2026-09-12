import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from '../../shared/entities/venue.entity';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

@Module({
  imports: [TypeOrmModule.forFeature([Venue])],
  providers: [VenueService, BusinessContextService], // ← CHANGED (multi-tenancy)
  controllers: [VenueController],
  exports: [VenueService],
})
export class VenueModule {}