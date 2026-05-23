import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';

interface CreateTicketDto {
  eventId: string;
  quantity: number;
  totalPrice: number;
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
  ) {}

  async createTicket(
    userId: string,
    createTicketDto: CreateTicketDto,
    ipAddress: string,
  ): Promise<Booking> {
    const booking = new Booking();
    booking.bookingType = BookingType.TICKET;
    booking.userId = userId;
    booking.resourceId = createTicketDto.eventId;
    booking.basePrice = createTicketDto.totalPrice;
    booking.guestCount = createTicketDto.quantity;
    booking.serviceCharge = 400;
    booking.platformCommission = createTicketDto.totalPrice * 0.03;
    booking.totalAmount = createTicketDto.totalPrice + 400;
    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;

    const saved = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_CREATED,
      actorId: userId,
      resourceType: 'ticket',
      resourceId: saved.id,
      changes: { quantity: createTicketDto.quantity, price: createTicketDto.totalPrice },
      ipAddress,
    });

    return saved;
  }

  async getTicket(ticketId: string): Promise<Booking> {
    const ticket = await this.bookingRepository.findOne({
      where: { id: ticketId, bookingType: BookingType.TICKET },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async getUserTickets(userId: string, limit = 20, offset = 0) {
    return this.bookingRepository.findAndCount({
      where: { userId, bookingType: BookingType.TICKET },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async cancelTicket(ticketId: string, userId: string, ipAddress: string): Promise<Booking> {
    const ticket = await this.getTicket(ticketId);

    if (ticket.userId !== userId) {
      throw new BadRequestException('Cannot cancel ticket of another user');
    }

    if (ticket.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Ticket already cancelled');
    }

    ticket.status = BookingStatus.CANCELLED;
    ticket.cancelledAt = new Date();

    const updated = await this.bookingRepository.save(ticket);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_UPDATED,
      actorId: userId,
      resourceType: 'ticket',
      resourceId: ticketId,
      changes: { status: 'CANCELLED' },
      ipAddress,
    });

    return updated;
  }
}