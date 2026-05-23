import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Event } from '../../shared/entities/event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
  ) {}

  async createEvent(data: Partial<Event>): Promise<Event> {
    const event = this.eventRepo.create(data);
    return this.eventRepo.save(event);
  }

  async getEvent(eventId: string): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async getAllEvents(
    limit  = 50,
    offset = 0,
    status?: string,
    venueId?: string,
  ): Promise<{ events: Event[]; total: number }> {
    const where: FindOptionsWhere<Event> = {};
    if (status)  where.status  = status;
    if (venueId) where.venueId = venueId;

    const [events, total] = await this.eventRepo.findAndCount({
      where,
      order:  { startDate: 'ASC' },
      take:   limit,
      skip:   offset,
    });

    return { events, total };
  }

  async updateEvent(eventId: string, data: Partial<Event>): Promise<Event> {
    await this.getEvent(eventId); // throws 404 if not found
    await this.eventRepo.update(eventId, data);
    return this.getEvent(eventId);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.getEvent(eventId); // throws 404 if not found
    await this.eventRepo.delete(eventId);
  }
}