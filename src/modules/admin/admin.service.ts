import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User }    from '../../shared/entities/user.entity';
import { Booking } from '../../shared/entities/booking.entity';
import { UserRole, AuditActionType, BookingStatus } from '../../shared/enums';
import { AuditService }        from '../audit/audit.service';
import { NotificationService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── Generate a secure random one-time password ───────────────────────────
  // Format: 3 uppercase + 3 digits + 3 lowercase = readable but strong enough
  // e.g. "ABX492kqm"
  private generateOneTimePassword(): string {
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits  = '23456789';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const all     = upper + digits + lower;

    const rand = (chars: string) =>
      chars[crypto.randomInt(0, chars.length)];

    const core = [rand(upper), rand(upper), rand(upper),
                  rand(digits), rand(digits), rand(digits),
                  rand(lower), rand(lower), rand(lower)];

    // Shuffle so the pattern isn't predictable
    return core
      .map((c, i) => ({ c, sort: crypto.randomInt(0, 100) }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.c)
      .join('');
  }

  // ─── ADD STAFF ────────────────────────────────────────────────────────────
  async addStaff(
    staffData: {
      email:     string;
      firstName: string;
      lastName:  string;
      role:      UserRole;
      phone?:    string;
    },
    adminId:   string,
    ipAddress: string,
  ): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: staffData.email },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    // ✅ Generate unique random password instead of hardcoded default
    const temporaryPassword = this.generateOneTimePassword();
    const hashedPassword    = await bcrypt.hash(temporaryPassword, 12);

    const user = this.userRepository.create({
      email:        staffData.email,
      passwordHash: hashedPassword,
      firstName:    staffData.firstName,
      lastName:     staffData.lastName,
      phone:        staffData.phone,
      role:         staffData.role,
      isActive:     true,
    });

    const savedUser = await this.userRepository.save(user) as User;

    // ✅ Send the temporary password via push notification
    // In production this should also trigger an email
    await this.notificationService.sendNotification(
      savedUser.id,
      'Welcome to D\'Lifestyle Staff Portal',
      `Your account has been created. Temporary password: ${temporaryPassword}. ` +
      `Please log in and change it immediately.`,
    );

    await this.auditService.logAction({
      actionType:   AuditActionType.USER_CREATED,
      actorId:      adminId,
      actorRole:    UserRole.ADMIN,
      resourceType: 'staff',
      resourceId:   savedUser.id,
      changes: {
        email: staffData.email,
        role:  staffData.role,
      },
      ipAddress,
    });

    // Return user WITHOUT exposing the password hash
    const { passwordHash: _, ...safeUser } = savedUser as any;
    return safeUser;
  }

  // ─── UPDATE STAFF ROLE ────────────────────────────────────────────────────
  async updateStaffRole(
    staffId:   string,
    newRole:   UserRole,
    adminId:   string,
    ipAddress: string,
  ): Promise<User> {
    const staff = await this.userRepository.findOne({ where: { id: staffId } });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    // Prevent downgrading a SUPER_ADMIN via this route
    if (staff.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'SUPER_ADMIN role cannot be changed through this endpoint',
      );
    }

    const oldRole = staff.role;
    staff.role    = newRole;
    const updated = await this.userRepository.save(staff);

    await this.auditService.logAction({
      actionType:   AuditActionType.USER_UPDATED,
      actorId:      adminId,
      actorRole:    UserRole.ADMIN,
      resourceType: 'staff',
      resourceId:   staffId,
      changes:      { role: { from: oldRole, to: newRole } },
      ipAddress,
    });

    return updated;
  }

  // ─── LIST STAFF ───────────────────────────────────────────────────────────
  async listStaff(limit = 50, offset = 0) {
    return this.userRepository.findAndCount({
      where: {
        role: In([
          UserRole.WAITER,
          UserRole.KITCHEN_STAFF,
          UserRole.BAR_STAFF,
          UserRole.DOOR_STAFF,
          UserRole.MANAGER,
          UserRole.ADMIN,
        ]),
      },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt'],
      skip:  offset,
      take:  limit,
      order: { createdAt: 'DESC' },
    });
  }

  // ─── DEACTIVATE STAFF ─────────────────────────────────────────────────────
  async deactivateStaff(
    staffId:   string,
    adminId:   string,
    ipAddress: string,
  ): Promise<User> {
    const staff = await this.userRepository.findOne({ where: { id: staffId } });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (staff.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('SUPER_ADMIN accounts cannot be deactivated here');
    }

    staff.isActive = false;
    const updated  = await this.userRepository.save(staff);

    await this.auditService.logAction({
      actionType:   AuditActionType.USER_UPDATED,
      actorId:      adminId,
      actorRole:    UserRole.ADMIN,
      resourceType: 'staff',
      resourceId:   staffId,
      changes:      { isActive: false },
      ipAddress,
    });

    return updated;
  }

  // ─── GET BOOKING (ADMIN VIEW) ─────────────────────────────────────────────
  async getBookingOverride(bookingId: string) {
    return this.bookingRepository.findOne({
      where:     { id: bookingId },
      relations: ['user', 'payments'],
    });
  }

  // ─── OVERRIDE BOOKING STATUS ──────────────────────────────────────────────
  async overrideBookingStatus(
    bookingId:  string,
    newStatus:  BookingStatus,
    adminId:    string,
    ipAddress:  string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const oldStatus  = booking.status;
    booking.status   = newStatus;
    const updated    = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType:   AuditActionType.ADMIN_OVERRIDE,
      actorId:      adminId,
      actorRole:    UserRole.ADMIN,
      resourceType: 'booking',
      resourceId:   bookingId,
      changes:      { status: { from: oldStatus, to: newStatus } },
      ipAddress,
    });

    return updated;
  }
}