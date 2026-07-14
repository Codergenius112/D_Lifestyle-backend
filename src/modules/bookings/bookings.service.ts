import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { GroupBooking } from '../../shared/entities/group-booking.entity';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import {
  BookingStatus,
  BookingType,
  PaymentStatus,
  AuditActionType,
  CommissionPayer,
} from '../../shared/enums';
import { BookingStateMachine } from '../../shared/services/state-machine.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BookingService {
  private readonly SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(GroupBooking)
    private groupBookingRepository: Repository<GroupBooking>,
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  private async getPlatformSettings(): Promise<PlatformSettings> {
    let settings = await this.platformSettingsRepository.findOne({ where: { id: this.SINGLETON_ID } });
    if (!settings) {
      settings = this.platformSettingsRepository.create({ id: this.SINGLETON_ID });
      await this.platformSettingsRepository.save(settings);
    }
    return settings;
  }

  async createBooking(createBookingDto: any, userId: string, ipAddress: string) {
    const platformSettings = await this.getPlatformSettings();
    const commissionRate = Number(platformSettings.commissionRate) || 0.03;
    const serviceCharge = Number(platformSettings.serviceCharge) || 400;
    const commissionPayer = platformSettings.commissionPayer || CommissionPayer.USER;

    const booking = new Booking();
    booking.bookingType = createBookingDto.bookingType;
    booking.userId = userId;
    booking.resourceId = createBookingDto.resourceId;
    booking.guestCount = createBookingDto.guestCount;
    booking.basePrice = createBookingDto.basePrice;
    booking.serviceCharge = serviceCharge;
    booking.platformCommission = booking.basePrice * commissionRate;
    booking.metadata = { commissionPayer, commissionRate };

    // If USER pays commission: add to total
    if (commissionPayer === CommissionPayer.USER) {
      booking.totalAmount = booking.basePrice + serviceCharge + booking.platformCommission;
    } else {
      // Admin pays - user only pays base + service charge
      booking.totalAmount = booking.basePrice + serviceCharge;
    }

    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;
    booking.metadata = { ...booking.metadata, ...(createBookingDto.metadata || {}) };

    const savedBooking = await this.bookingRepository.save(booking);

    // Log audit
    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_CREATED,
      actorId: userId,
      resourceType: 'booking',
      resourceId: savedBooking.id,
      changes: { created: true },
      ipAddress,
    });

    return savedBooking;
  }

  async getBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['payments', 'user'],
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    return booking;
  }

  async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    userId: string,
    ipAddress: string,
  ): Promise<Booking> {
    const booking = await this.getBooking(bookingId);
    const stateMachine = new BookingStateMachine(booking.status);

    if (!stateMachine.canTransition(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${booking.status} to ${newStatus}`,
      );
    }

    const oldStatus = booking.status;
    booking.status = newStatus;

    if (newStatus === BookingStatus.COMPLETED) {
      booking.completedAt = new Date();
    } else if (newStatus === BookingStatus.CANCELLED) {
      booking.cancelledAt = new Date();
    } else if (newStatus === BookingStatus.EXPIRED) {
      booking.expiresAt = new Date();
    }

    const updatedBooking = await this.bookingRepository.save(booking);

    // Audit log
    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_UPDATED,
      actorId: userId,
      resourceType: 'booking',
      resourceId: bookingId,
      changes: { status: { from: oldStatus, to: newStatus } },
      ipAddress,
    });

    return updatedBooking;
  }

  async createGroupBooking(
    initiatorId: string,
    bookingData: any,
    ipAddress: string,
  ): Promise<Booking & { groupBookingId: string }> {
    const platformSettings = await this.getPlatformSettings();
    const commissionRate = Number(platformSettings.commissionRate) || 0.03;
    const serviceCharge = Number(platformSettings.serviceCharge) || 400;
    const commissionPayer = platformSettings.commissionPayer || CommissionPayer.USER;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create main booking
      const booking = new Booking();
      booking.bookingType = bookingData.bookingType;
      booking.userId = initiatorId;
      booking.resourceId = bookingData.resourceId;
      booking.guestCount = bookingData.guestCount;
      booking.basePrice = bookingData.basePrice;
      booking.serviceCharge = serviceCharge;
      booking.platformCommission = booking.basePrice * commissionRate;

      // If USER pays commission: add to total
      if (commissionPayer === CommissionPayer.USER) {
        booking.totalAmount = booking.basePrice + serviceCharge + booking.platformCommission;
      } else {
        booking.totalAmount = booking.basePrice + serviceCharge;
      }

      booking.status = BookingStatus.PENDING_GROUP_PAYMENT;
      booking.paymentStatus = PaymentStatus.UNPAID;
      booking.metadata = { commissionPayer, commissionRate };

      const savedBooking = await queryRunner.manager.save(booking);

      // Create group booking record
      const groupBooking = new GroupBooking();
      groupBooking.bookingId = savedBooking.id;
      groupBooking.initiatorId = initiatorId;
      groupBooking.participantIds = [initiatorId, ...bookingData.participantIds];
      groupBooking.contributionTracker = {};
      groupBooking.totalRequired = savedBooking.totalAmount;
      groupBooking.countdownExpiresAt = new Date(Date.now() + 8 * 60 * 1000); // 8 minutes

      await queryRunner.manager.save(groupBooking);

      await queryRunner.commitTransaction();

      await this.auditService.logAction({
        actionType: AuditActionType.BOOKING_CREATED,
        actorId: initiatorId,
        resourceType: 'booking',
        resourceId: savedBooking.id,
        changes: { type: 'group', participants: groupBooking.participantIds },
        ipAddress,
      });

      // groupBookingId (the GroupBooking record's own id) is needed by the
      // frontend for GET /bookings/group/:id and the contribute endpoint —
      // it's a different id from the underlying Booking's id, so it has to
      // be surfaced here explicitly.
      return { ...savedBooking, groupBookingId: groupBooking.id } as Booking & { groupBookingId: string };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async contributeToGroupBooking(
    groupBookingId: string,
    participantId: string,
    amount: number,
    ipAddress: string,
  ): Promise<GroupBooking> {
    const groupBooking = await this.groupBookingRepository.findOne({
      where: { id: groupBookingId },
    });

    if (!groupBooking) {
      throw new NotFoundException(`Group booking ${groupBookingId} not found`);
    }

    if (!groupBooking.participantIds.includes(participantId)) {
      throw new BadRequestException('User is not a participant in this group booking');
    }

    groupBooking.contributionTracker[participantId] = amount;
    groupBooking.totalPaid = Object.values(groupBooking.contributionTracker).reduce(
      (sum: number, val: any) => sum + val,
      0,
    );

    const updated = await this.groupBookingRepository.save(groupBooking);

    await this.auditService.logAction({
      actionType: AuditActionType.BOOKING_UPDATED,
      actorId: participantId,
      resourceType: 'group_booking',
      resourceId: groupBookingId,
      changes: { contribution: amount },
      ipAddress,
    });

    return updated;
  }

  async listUserBookings(userId: string, limit = 20, offset = 0): Promise<[Booking[], number]> {
    return this.bookingRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['payments', 'user'],
    });
  }

  async resolveCautionFee(
    bookingId:  string,
    resolution: 'REFUNDED' | 'FORFEITED',
    adminId:    string,
  ) {
    const booking = await this.bookingRepository.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Caution fee can only be resolved on COMPLETED bookings');
    }
    if (booking.cautionFeeStatus !== 'HELD') {
      throw new BadRequestException(`Caution fee is already ${booking.cautionFeeStatus}`);
    }

    booking.cautionFeeStatus     = resolution;
    booking.cautionFeeResolvedAt = new Date();
    booking.cautionFeeResolvedBy = adminId;
    await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: resolution === 'REFUNDED'
        ? AuditActionType.CAUTION_FEE_REFUNDED
        : AuditActionType.CAUTION_FEE_FORFEITED,
      actorId:      adminId,
      resourceType: 'booking',
      resourceId:   bookingId,
      changes:      { cautionFeeStatus: resolution, cautionFeeAmount: booking.cautionFeeAmount },
    });

    return booking;
  }
}