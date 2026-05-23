import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../../shared/entities/event.entity';
import { EventsService }    from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Event])],
  providers:   [EventsService],
  controllers: [EventsController],
  exports:     [EventsService],
})
export class EventsModule {}