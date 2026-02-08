import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../shared/entities/user.entity';
import { Booking } from '../../shared/entities/booking.entity';
import { UserRole, AuditActionType } from '../../shared/enums';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private auditService: AuditService,
  ) {}

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
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash('DefaultPassword123', 10);

    const user = new User();
    user.email = staffData.email;
    user.passwordHash = hashedPassword;
    user.firstName = staffData.firstName;
    user.lastName = staffData.lastName;
    user.phone = staffData.phone;
    user.role = staffData.role;

    const savedUser = await this.userRepository.save(user);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_CREATED,
      actorId: adminId,
      resourceType: 'staff',
      resourceId: savedUser.id,
      changes: { email: staffData.email, role: staffData.role },
      ipAddress,
    });

    return savedUser;
  }

  async updateStaffRole(
    staffId: string,
    newRole: UserRole,
    adminId: string,
    ipAddress: string,
  ): Promise<User> {
    const staff = await this.userRepository.findOne({ where: { id: staffId } });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const oldRole = staff.role;
    staff.role = newRole;

    const updated = await this.userRepository.save(staff);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED,
      actorId: adminId,
      resourceType: 'staff',
      resourceId: staffId,
      changes: { role: { from: oldRole, to: newRole } },
      ipAddress,
    });

    return updated;
  }

  async listStaff(limit = 50, offset = 0) {
    return this.userRepository.findAndCount({
      where: { role: UserRole.MANAGER },
      skip: offset,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async deactivateStaff(staffId: string, adminId: string, ipAddress: string): Promise<User> {
    const staff = await this.userRepository.findOne({ where: { id: staffId } });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    staff.isActive = false;

    const updated = await this.userRepository.save(staff);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED,
      actorId: adminId,
      resourceType: 'staff',
      resourceId: staffId,
      changes: { isActive: false },
      ipAddress,
    });

    return updated;
  }

  async getBookingOverride(bookingId: string) {
    return this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['user', 'payments'],
    });
  }

  async overrideBookingStatus(
    bookingId: string,
    newStatus: string,
    adminId: string,
    ipAddress: string,
  ) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    const oldStatus = booking.status;
    booking.status = newStatus as any;

    const updated = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.ADMIN_OVERRIDE,
      actorId: adminId,
      resourceType: 'booking',
      resourceId: bookingId,
      changes: { status: { from: oldStatus, to: newStatus } },
      ipAddress,
    });

    return updated;
  }
}