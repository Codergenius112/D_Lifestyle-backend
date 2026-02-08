import { Injectable, NotFoundException } from '@nestjs/common';

interface Event {
  id: string;
  name: string;
  description: string;
  venueId: string;
  startDate: string;
  endDate: string;
  capacity: number;
  djs?: string[];
  genre?: string;
  dresscode?: string;
  status: string;
  createdAt: string;
}

@Injectable()
export class EventsService {
  private events: Event[] = [];

  async createEvent(eventData: Partial<Event>): Promise<Event> {
    const event: Event = {
      id: Math.random().toString(36).substr(2, 9),
      name: eventData.name || '',
      description: eventData.description || '',
      venueId: eventData.venueId || '',
      startDate: eventData.startDate || '',
      endDate: eventData.endDate || '',
      capacity: eventData.capacity || 0,
      djs: eventData.djs || [],
      genre: eventData.genre,
      dresscode: eventData.dresscode,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.events.push(event);
    return event;
  }

  async getEvent(eventId: string): Promise<Event> {
    const event = this.events.find((e) => e.id === eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async getAllEvents(limit = 50, offset = 0) {
    const events = this.events.slice(offset, offset + limit);
    return { events, total: this.events.length };
  }

  async updateEvent(eventId: string, updateData: Partial<Event>): Promise<Event> {
    const event = await this.getEvent(eventId);
    Object.assign(event, updateData);
    return event;
  }

  async deleteEvent(eventId: string): Promise<void> {
    const index = this.events.findIndex((e) => e.id === eventId);

    if (index === -1) {
      throw new NotFoundException('Event not found');
    }

    this.events.splice(index, 1);
  }
}