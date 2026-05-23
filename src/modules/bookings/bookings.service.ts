import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { GroupBooking } from '../../shared/entities/group-booking.entity';
import {
  BookingStatus,
  BookingType,
  PaymentStatus,
  AuditActionType,
} from '../../shared/enums';
import { BookingStateMachine } from '../../shared/services/state-machine.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(GroupBooking)
    private groupBookingRepository: Repository<GroupBooking>,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  async createBooking(createBookingDto: any, userId: string, ipAddress: string) {
    const booking = new Booking();
    booking.bookingType = createBookingDto.bookingType;
    booking.userId = userId;
    booking.resourceId = createBookingDto.resourceId;
    booking.guestCount = createBookingDto.guestCount;
    booking.basePrice = createBookingDto.basePrice;
    booking.serviceCharge = parseFloat(process.env.SERVICE_CHARGE ?? '400');
    booking.platformCommission = booking.basePrice * 0.03; // 3% commission
    booking.totalAmount = booking.basePrice + booking.serviceCharge;
    booking.status = BookingStatus.INITIATED;
    booking.paymentStatus = PaymentStatus.UNPAID;
    booking.metadata = createBookingDto.metadata || {};

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
  ): Promise<Booking> {
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
      booking.serviceCharge = parseFloat(process.env.SERVICE_CHARGE ?? '400');
      booking.platformCommission = booking.basePrice * 0.03;
      booking.totalAmount = booking.basePrice + booking.serviceCharge;
      booking.status = BookingStatus.PENDING_GROUP_PAYMENT;
      booking.paymentStatus = PaymentStatus.UNPAID;

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

      return savedBooking;
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
}