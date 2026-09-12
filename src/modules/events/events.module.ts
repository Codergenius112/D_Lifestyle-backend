import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../../shared/entities/event.entity';
import { EventsService }    from './events.service';
import { EventsController } from './events.controller';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

@Module({
  imports:     [TypeOrmModule.forFeature([Event])],
  providers:   [EventsService, BusinessContextService], // ← CHANGED (multi-tenancy)
  controllers: [EventsController],
  exports:     [EventsService],
})
export class EventsModule {}