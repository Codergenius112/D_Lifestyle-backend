import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { Event } from '../../shared/entities/event.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType, CommissionPayer } from '../../shared/enums';
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
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
    private auditService: AuditService,
  ) {}

  private async getPlatformSettings(): Promise<PlatformSettings> {
    const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';
    let settings = await this.platformSettingsRepository.findOne({ where: { id: SINGLETON_ID } });
    if (!settings) {
      settings = this.platformSettingsRepository.create({ id: SINGLETON_ID });
      await this.platformSettingsRepository.save(settings);
    }
    return settings;
  }

  async createTicket(
    userId: string,
    createTicketDto: CreateTicketDto,
    ipAddress: string,
  ): Promise<Booking> {
    // Fetch event to get commission payer setting
    const event = await this.eventRepository.findOne({
      where: { id: createTicketDto.eventId },
    });

    // Get platform settings for commission rate and service charge
    const platformSettings = await this.getPlatformSettings();
    const commissionRate = Number(platformSettings.commissionRate) || 0.03;
    const serviceCharge = Number(platformSettings.serviceCharge) || 400;

    // Determine who pays commission
    const commissionPayer = event?.commissionPayer || platformSettings.commissionPayer || CommissionPayer.USER;
    const basePrice = createTicketDto.totalPrice;
    const commission = basePrice * commissionRate;

    const booking = new Booking();
    booking.bookingType = BookingType.TICKET;
    booking.userId = userId;
    booking.resourceId = createTicketDto.eventId;
    booking.basePrice = basePrice;
    booking.guestCount = createTicketDto.quantity;
    booking.serviceCharge = serviceCharge;
    booking.platformCommission = commission;

    // If USER pays commission: add to total (basePrice + serviceCharge + commission)
    // If ADMIN pays commission: deduct from payout, user doesn't see it in total
    if (commissionPayer === CommissionPayer.USER) {
      booking.totalAmount = basePrice + serviceCharge + commission;
    } else {
      // Admin pays - user only pays base + service charge
      booking.totalAmount = basePrice + serviceCharge;
    }

    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;
    booking.metadata = {
      commissionPayer,
      commissionRate,
      platformSettingsCommissionPayer: platformSettings.commissionPayer,
      eventCommissionPayer: event?.commissionPayer,
    };

    const saved = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_CREATED,
      actorId: userId,
      resourceType: 'ticket',
      resourceId: saved.id,
      changes: { quantity: createTicketDto.quantity, price: createTicketDto.totalPrice, commissionPayer },
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
