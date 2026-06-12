import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User }    from '../../shared/entities/user.entity';
import { Booking } from '../../shared/entities/booking.entity';
import { UserRole, AuditActionType, BookingStatus, BusinessScope } from '../../shared/enums';
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

  private generateOneTimePassword(): string {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const lower  = 'abcdefghjkmnpqrstuvwxyz';
    const rand   = (chars: string) => chars[crypto.randomInt(0, chars.length)];
    const core   = [rand(upper), rand(upper), rand(upper),
                    rand(digits), rand(digits), rand(digits),
                    rand(lower), rand(lower), rand(lower)];
    return core
      .map((c) => ({ c, sort: crypto.randomInt(0, 100) }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.c)
      .join('');
  }

  async addStaff(
    staffData: { email: string; firstName: string; lastName: string; role: UserRole; phone?: string; password?: string; businessScopes?: BusinessScope[] },
    adminId: string, ipAddress: string,
  ): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: staffData.email } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const temporaryPassword = staffData.password ?? this.generateOneTimePassword();
    const hashedPassword    = await bcrypt.hash(temporaryPassword, 12);

    const user = this.userRepository.create({
      email: staffData.email, passwordHash: hashedPassword,
      firstName: staffData.firstName, lastName: staffData.lastName,
      phone: staffData.phone, role: staffData.role, isActive: true,
      businessScopes: staffData.businessScopes ?? null,
    });

    const savedUser = await this.userRepository.save(user) as User;

    await this.notificationService.sendNotification(
      savedUser.id,
      "Welcome to D'Lifestyle Staff Portal",
      `Your account has been created. Temporary password: ${temporaryPassword}. Please log in and change it immediately.`,
    );

    await this.auditService.logAction({
      actionType: AuditActionType.USER_CREATED, actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'staff', resourceId: savedUser.id,
      changes: { email: staffData.email, role: staffData.role }, ipAddress,
    });

    const { passwordHash: _, ...safeUser } = savedUser as any;
    return safeUser;
  }

  async listStaff(params: { limit?: number; offset?: number; search?: string; role?: UserRole }) {
    const staffRoles = [
      UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF,
      UserRole.DOOR_STAFF, UserRole.MANAGER, UserRole.ADMIN,
    ];
    const qb = this.userRepository.createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.firstName', 'u.lastName', 'u.role',
               'u.isActive', 'u.businessScopes', 'u.lastLoginAt', 'u.createdAt'])
      .where('u.role IN (:...roles)', { roles: staffRoles })
      .andWhere('u.isDeleted = false');
    if (params.search) {
      qb.andWhere('(u.email ILIKE :s OR u.firstName ILIKE :s OR u.lastName ILIKE :s)',
        { s: `%${params.search}%` });
    }
    if (params.role) qb.andWhere('u.role = :role', { role: params.role });
    qb.take(params.limit ?? 50).skip(params.offset ?? 0).orderBy('u.createdAt', 'DESC');
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getStaffDetails(staffId: string) {
    const user = await this.userRepository.findOne({
      where: { id: staffId },
      select: ['id', 'email', 'firstName', 'lastName', 'role',
               'isActive', 'businessScopes', 'lastLoginAt', 'createdAt'],
    });
    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }

  async updateStaffRole(staffId: string, newRole: UserRole, adminId: string, ipAddress: string) {
    const user = await this.userRepository.findOne({ where: { id: staffId } });
    if (!user) throw new NotFoundException('Staff member not found');
    if (user.role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('SUPER_ADMIN role cannot be changed through this endpoint');
    const oldRole = user.role;
    user.role = newRole;
    await this.userRepository.save(user);
    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED, actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'user', resourceId: staffId,
      changes: { before: { role: oldRole }, after: { role: newRole } }, ipAddress,
    });
    return { message: 'Role updated', user: { id: user.id, email: user.email, role: user.role } };
  }

  async deactivateStaff(staffId: string, adminId: string, ipAddress: string) {
    const user = await this.userRepository.findOne({ where: { id: staffId } });
    if (!user) throw new NotFoundException('Staff member not found');
    if (user.role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('SUPER_ADMIN accounts cannot be deactivated here');
    user.isActive = false;
    await this.userRepository.save(user);
    await this.auditService.logAction({
      actionType: AuditActionType.STAFF_DEACTIVATED, actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'user', resourceId: staffId,
      changes: { before: { isActive: true }, after: { isActive: false } }, ipAddress,
    });
    return { message: 'Staff member deactivated' };
  }

  async overrideBookingStatus(
    bookingId: string, newStatus: BookingStatus, adminId: string, ipAddress: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    const oldStatus = booking.status;
    booking.status  = newStatus;
    const updated   = await this.bookingRepository.save(booking);
    await this.auditService.logAction({
      actionType: AuditActionType.ADMIN_OVERRIDE, actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'booking', resourceId: bookingId,
      changes: { status: { from: oldStatus, to: newStatus } }, ipAddress,
    });
    return updated;
  }
}