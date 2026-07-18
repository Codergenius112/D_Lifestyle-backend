import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { BookingType, BookingStatus, PaymentStatus, AuditActionType, CommissionPayer } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';

interface CreateTicketDto {
  eventId: string;
  quantity: number;
  totalPrice: number; // basePrice for `quantity` tickets, before service charge — matches mobile api.ts
}

@Injectable()
export class TicketsService {
  private readonly SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
    private auditService: AuditService,
  ) {}

  private async getPlatformSettings(): Promise<PlatformSettings> {
    let settings = await this.platformSettingsRepository.findOne({ where: { id: this.SINGLETON_ID } });
    if (!settings) {
      settings = this.platformSettingsRepository.create({ id: this.SINGLETON_ID });
      await this.platformSettingsRepository.save(settings);
    }
    return settings;
  }

  // ── POST /tickets ───────────────────────────────────────────────────────────
  async createTicket(userId: string, dto: CreateTicketDto, ipAddress: string): Promise<Booking> {
    const platformSettings = await this.getPlatformSettings();
    const commissionRate = Number(platformSettings.commissionRate) || 0.03;
    const serviceCharge = Number(platformSettings.serviceCharge) || 400;
    const commissionPayer = platformSettings.commissionPayer || CommissionPayer.USER;

    const basePrice = Number(dto.totalPrice ?? 0);
    const commission = basePrice * commissionRate;

    const booking = this.bookingRepository.create({
      bookingType: BookingType.TICKET,
      userId,
      resourceId: dto.eventId,
      guestCount: dto.quantity ?? 1,
      basePrice,
      serviceCharge,
      platformCommission: commission,
      totalAmount: commissionPayer === CommissionPayer.USER
        ? basePrice + serviceCharge + commission
        : basePrice + serviceCharge,
      status: BookingStatus.INITIATED,
      paymentStatus: PaymentStatus.UNPAID,
      metadata: {
        eventId: dto.eventId,
        commissionPayer,
        commissionRate,
      },
    });

    const saved = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_CREATED,
      actorId: userId,
      resourceType: 'ticket',
      resourceId: saved.id,
      changes: { quantity: dto.quantity, totalPrice: dto.totalPrice },
      ipAddress,
    });

    return saved;
  }

  // ── GET /tickets ───────────────────────────────────────────────────────────
  async getUserTickets(userId: string, limit = 20, offset = 0) {
    return this.bookingRepository.findAndCount({
      where: { userId, bookingType: BookingType.TICKET },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  // ── GET /tickets/:id ───────────────────────────────────────────────────────
  async getTicket(ticketId: string): Promise<Booking> {
    const ticket = await this.bookingRepository.findOne({
      where: { id: ticketId, bookingType: BookingType.TICKET },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  // ── PATCH /tickets/:id/cancel ─────────────────────────────────────────────
  async cancelTicket(ticketId: string, userId: string, ipAddress: string): Promise<Booking> {
    const ticket = await this.bookingRepository.findOne({
      where: { id: ticketId, userId, bookingType: BookingType.TICKET },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.status = BookingStatus.CANCELLED;
    ticket.cancelledAt = new Date();
    ticket.metadata = {
      ...(ticket.metadata ?? {}),
      cancelledByUser: true,
      ipAddress,
    };

    return this.bookingRepository.save(ticket);
  }
}
