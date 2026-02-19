import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../shared/entities/user.entity';
import { Booking } from '../../shared/entities/booking.entity';
import { UserRole, AuditActionType, BookingStatus } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';
import { In } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    private readonly auditService: AuditService,
  ) {}

  // =========================
  // ADD STAFF
  // =========================
  async addStaff(
    staffData: {
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      phone?: string;
    },
    adminId: string,
    ipAddress: string,
  ): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: staffData.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash('DefaultPassword123', 10);

    const user = this.userRepository.create({
      email: staffData.email,
      passwordHash: hashedPassword,
      firstName: staffData.firstName,
      lastName: staffData.lastName,
      phone: staffData.phone,
      role: staffData.role,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_CREATED,
      actorId: adminId,
      actorRole: UserRole.ADMIN, // ✅ Correct actor role
      resourceType: 'staff',
      resourceId: savedUser.id,
      changes: {
        email: staffData.email,
        role: staffData.role,
      },
      ipAddress,
    });

    return savedUser;
  }

  // =========================
  // UPDATE STAFF ROLE
  // =========================
  async updateStaffRole(
    staffId: string,
    newRole: UserRole,
    adminId: string,
    ipAddress: string,
  ): Promise<User> {
    const staff = await this.userRepository.findOne({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const oldRole = staff.role;
    staff.role = newRole;

    const updated = await this.userRepository.save(staff);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED,
      actorId: adminId,
      actorRole: UserRole.ADMIN,
      resourceType: 'staff',
      resourceId: staffId,
      changes: {
        role: { from: oldRole, to: newRole },
      },
      ipAddress,
    });

    return updated;
  }

  // =========================
  // LIST STAFF
  // =========================
async listStaff(limit = 50, offset = 0) {
  return this.userRepository.findAndCount({
    where: {
      role: In([
        UserRole.WAITER,
        UserRole.KITCHEN_STAFF,
        UserRole.BAR_STAFF,
        UserRole.DOOR_STAFF,
        UserRole.MANAGER,
      ]),
    },
    skip: offset,
    take: limit,
    order: { createdAt: 'DESC' },
  });
}


  // =========================
  // DEACTIVATE STAFF
  // =========================
  async deactivateStaff(
    staffId: string,
    adminId: string,
    ipAddress: string,
  ): Promise<User> {
    const staff = await this.userRepository.findOne({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    staff.isActive = false;

    const updated = await this.userRepository.save(staff);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED,
      actorId: adminId,
      actorRole: UserRole.ADMIN,
      resourceType: 'staff',
      resourceId: staffId,
      changes: { isActive: false },
      ipAddress,
    });

    return updated;
  }

  // =========================
  // GET BOOKING (ADMIN VIEW)
  // =========================
  async getBookingOverride(bookingId: string) {
    return this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['user', 'payments'],
    });
  }

  // =========================
  // OVERRIDE BOOKING STATUS
  // =========================
  async overrideBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    adminId: string,
    ipAddress: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const oldStatus = booking.status;
    booking.status = newStatus; // ✅ No more "as any"

    const updated = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.ADMIN_OVERRIDE,
      actorId: adminId,
      actorRole: UserRole.ADMIN,
      resourceType: 'booking',
      resourceId: bookingId,
      changes: {
        status: { from: oldStatus, to: newStatus },
      },
      ipAddress,
    });

    return updated;
  }
}
