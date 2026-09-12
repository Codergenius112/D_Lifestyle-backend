import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Event } from '../../shared/entities/event.entity';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    private readonly businessContext: BusinessContextService, // ← NEW (multi-tenancy)
  ) {}

  async createEvent(data: Partial<Event>): Promise<Event> {
    const event = this.eventRepo.create(data);
    return this.eventRepo.save(event);
  }

  // ← CHANGED (multi-tenancy): businessIds replaces the old single ownerId.
  async getEvent(eventId: string, businessIds?: string[]): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (businessIds !== undefined && (!businessIds.length || !businessIds.includes((event as any).businessId))) {
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

  // Staff dashboard listing — scoped to the caller's own business(es)
  // unless super admin. Separate from getAllEvents so public browsing is
  // never accidentally affected by ownership scoping.
  async getEventsForOwner(
    limit = 50, offset = 0, status?: string, businessIds?: string[],
  ): Promise<{ events: Event[]; total: number }> {
    if (businessIds && businessIds.length === 0) return { events: [], total: 0 };

    const qb = this.eventRepo.createQueryBuilder('e');
    if (status) qb.andWhere('e.status = :status', { status });
    if (businessIds) qb.andWhere('e."businessId" IN (:...businessIds)', { businessIds });
    qb.orderBy('e.startDate', 'ASC').take(limit).skip(offset);
    const [events, total] = await qb.getManyAndCount();
    return { events, total };
  }

  async updateEvent(eventId: string, data: Partial<Event>, businessIds?: string[]): Promise<Event> {
    const event = await this.getEvent(eventId, businessIds); // throws 404 if not found or not accessible
    await this.businessContext.assertBusinessActive((event as any).businessId); // ← NEW (multi-tenancy)
    await this.eventRepo.update(eventId, data);
    return this.getEvent(eventId, businessIds);
  }

  async deleteEvent(eventId: string, businessIds?: string[]): Promise<void> {
    const event = await this.getEvent(eventId, businessIds); // throws 404 if not found or not accessible
    await this.businessContext.assertBusinessActive((event as any).businessId); // ← NEW (multi-tenancy)
    await this.eventRepo.delete(eventId);
  }
}