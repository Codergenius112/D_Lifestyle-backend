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

  async getEvent(eventId: string, ownerId?: string | null): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (ownerId !== undefined && event.ownerId !== ownerId) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  // Public browsing — unauthenticated, unscoped by design. Customers should
  // see every event on the platform regardless of who owns it.
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

  // Staff dashboard listing — scoped to the caller's own business unless
  // super admin. Separate from getAllEvents so public browsing is never
  // accidentally affected by ownership scoping.
  async getEventsForOwner(
    limit = 50, offset = 0, status?: string, ownerId?: string | null,
  ): Promise<{ events: Event[]; total: number }> {
    if (ownerId === null) return { events: [], total: 0 };

    const qb = this.eventRepo.createQueryBuilder('e');
    if (status) qb.andWhere('e.status = :status', { status });
    if (ownerId) qb.andWhere('e."ownerId" = :ownerId', { ownerId });
    qb.orderBy('e.startDate', 'ASC').take(limit).skip(offset);
    const [events, total] = await qb.getManyAndCount();
    return { events, total };
  }

  async updateEvent(eventId: string, data: Partial<Event>, ownerId?: string | null): Promise<Event> {
    await this.getEvent(eventId, ownerId); // throws 404 if not found or not owned
    await this.eventRepo.update(eventId, data);
    return this.getEvent(eventId, ownerId);
  }

  async deleteEvent(eventId: string, ownerId?: string | null): Promise<void> {
    await this.getEvent(eventId, ownerId); // throws 404 if not found or not owned
    await this.eventRepo.delete(eventId);
  }
}