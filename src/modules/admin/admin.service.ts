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

  // Roles a business owner (or their manager) is allowed to create via the
  // staff endpoint. ADMIN and SUPER_ADMIN are deliberately excluded — new
  // business owners are onboarded by super admin only (a separate flow),
  // and this endpoint must never be usable to mint another admin/super
  // admin account.
  private static readonly ADDABLE_STAFF_ROLES = [
    UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN_STAFF,
    UserRole.BAR_STAFF, UserRole.DOOR_STAFF,
  ];

  async addStaff(
    staffData: { email: string; firstName: string; lastName: string; role: UserRole; phone?: string; password?: string },
    creator: { id: string; role: UserRole; businessOwnerId?: string | null; businessScopes?: BusinessScope[] | null },
    ipAddress: string,
  ): Promise<User> {
    if (!AdminService.ADDABLE_STAFF_ROLES.includes(staffData.role)) {
      throw new BadRequestException(
        `Cannot create a staff member with role "${staffData.role}". Allowed roles: ${AdminService.ADDABLE_STAFF_ROLES.join(', ')}.`,
      );
    }

    const existing = await this.userRepository.findOne({ where: { email: staffData.email } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    // The business owner this staff member works for: if the creator is the
    // owner themselves, it's their own id; if the creator is a manager,
    // inherit the chain so staff always end up tied to the actual owner,
    // not to the manager who happened to create them.
    const businessOwnerId = creator.role === UserRole.ADMIN ? creator.id : creator.businessOwnerId;
    if (!businessOwnerId) {
      throw new BadRequestException('Your account is not linked to a business — cannot add staff.');
    }

    const temporaryPassword = staffData.password ?? this.generateOneTimePassword();
    const hashedPassword    = await bcrypt.hash(temporaryPassword, 12);

    const user = this.userRepository.create({
      email: staffData.email, passwordHash: hashedPassword,
      firstName: staffData.firstName, lastName: staffData.lastName,
      phone: staffData.phone, role: staffData.role, isActive: true,
      businessOwnerId,
      // Staff inherit the business's own scopes rather than picking their
      // own — they work for this business, not a subset of it.
      businessScopes: creator.businessScopes ?? null,
    });

    const savedUser = await this.userRepository.save(user) as User;

    await this.notificationService.sendNotification(
      savedUser.id,
      "Welcome to D'Lifestyle Staff Portal",
      `Your account has been created. Temporary password: ${temporaryPassword}. Please log in and change it immediately.`,
    );

    await this.auditService.logAction({
      actionType: AuditActionType.USER_CREATED, actorId: creator.id, actorRole: creator.role,
      resourceType: 'staff', resourceId: savedUser.id,
      changes: { email: staffData.email, role: staffData.role }, ipAddress,
    });

    const { passwordHash: _, ...safeUser } = savedUser as any;
    return safeUser;
  }

  // Onboards a new business owner (ADMIN role). Super admin only — this is
  // the one place an ADMIN account can be created; addStaff() explicitly
  // cannot create one, to keep owner onboarding a deliberate, separate act.
  async onboardBusinessOwner(
    ownerData: { email: string; firstName: string; lastName: string; phone?: string; password?: string; businessScopes: BusinessScope[] },
    superAdminId: string, ipAddress: string,
  ): Promise<User> {
    if (!ownerData.businessScopes?.length) {
      throw new BadRequestException('A business owner needs at least one business scope.');
    }

    const existing = await this.userRepository.findOne({ where: { email: ownerData.email } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const temporaryPassword = ownerData.password ?? this.generateOneTimePassword();
    const hashedPassword    = await bcrypt.hash(temporaryPassword, 12);

    const owner = this.userRepository.create({
      email: ownerData.email, passwordHash: hashedPassword,
      firstName: ownerData.firstName, lastName: ownerData.lastName,
      phone: ownerData.phone, role: UserRole.ADMIN, isActive: true,
      businessOwnerId: null, // owners are their own business owner, implicitly
      businessScopes: ownerData.businessScopes,
    });

    const savedOwner = await this.userRepository.save(owner) as User;

    await this.notificationService.sendNotification(
      savedOwner.id,
      "Welcome to D'Lifestyle",
      `Your business owner account has been created. Temporary password: ${temporaryPassword}. Please log in and change it immediately.`,
    );

    await this.auditService.logAction({
      actionType: AuditActionType.USER_CREATED, actorId: superAdminId, actorRole: UserRole.SUPER_ADMIN,
      resourceType: 'business_owner', resourceId: savedOwner.id,
      changes: { email: ownerData.email, businessScopes: ownerData.businessScopes }, ipAddress,
    });

    const { passwordHash: _, ...safeOwner } = savedOwner as any;
    return safeOwner;
  }

  // ownerId: undefined = no restriction (super admin sees all staff across
  // all businesses). null = restrict to nothing (caller has no business).
  // Otherwise, restrict to staff belonging to that specific business owner.
  async listStaff(params: { limit?: number; offset?: number; search?: string; role?: UserRole; ownerId?: string | null }) {
    if (params.ownerId === null) return { data: [], total: 0 };

    const staffRoles = [
      UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF,
      UserRole.DOOR_STAFF, UserRole.MANAGER, UserRole.ADMIN,
    ];
    const qb = this.userRepository.createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.firstName', 'u.lastName', 'u.role',
               'u.isActive', 'u.businessScopes', 'u.businessOwnerId', 'u.lastLoginAt', 'u.createdAt'])
      .where('u.role IN (:...roles)', { roles: staffRoles })
      .andWhere('u.isDeleted = false');
    if (params.ownerId) qb.andWhere('u."businessOwnerId" = :ownerId', { ownerId: params.ownerId });
    if (params.search) {
      qb.andWhere('(u.email ILIKE :s OR u.firstName ILIKE :s OR u.lastName ILIKE :s)',
        { s: `%${params.search}%` });
    }
    if (params.role) qb.andWhere('u.role = :role', { role: params.role });
    qb.take(params.limit ?? 50).skip(params.offset ?? 0).orderBy('u.createdAt', 'DESC');
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getStaffDetails(staffId: string, ownerId?: string | null) {
    const user = await this.userRepository.findOne({
      where: { id: staffId },
      select: ['id', 'email', 'firstName', 'lastName', 'role',
               'isActive', 'businessScopes', 'businessOwnerId', 'lastLoginAt', 'createdAt'],
    });
    if (!user) throw new NotFoundException('Staff member not found');
    if (ownerId !== undefined && user.businessOwnerId !== ownerId) {
      throw new NotFoundException('Staff member not found');
    }
    return user;
  }

  async updateStaffRole(staffId: string, newRole: UserRole, actor: { id: string; role: UserRole }, ownerId: string | null | undefined, ipAddress: string) {
    if (!AdminService.ADDABLE_STAFF_ROLES.includes(newRole)) {
      throw new BadRequestException(
        `Cannot set role to "${newRole}" through this endpoint. Allowed roles: ${AdminService.ADDABLE_STAFF_ROLES.join(', ')}.`,
      );
    }

    const user = await this.userRepository.findOne({ where: { id: staffId } });
    if (!user) throw new NotFoundException('Staff member not found');
    if (ownerId !== undefined && user.businessOwnerId !== ownerId) {
      throw new NotFoundException('Staff member not found');
    }
    if (user.role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('SUPER_ADMIN role cannot be changed through this endpoint');

    const oldRole = user.role;
    user.role = newRole;
    await this.userRepository.save(user);
    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED, actorId: actor.id, actorRole: actor.role,
      resourceType: 'user', resourceId: staffId,
      changes: { before: { role: oldRole }, after: { role: newRole } }, ipAddress,
    });
    return { message: 'Role updated', user: { id: user.id, email: user.email, role: user.role } };
  }

  async deactivateStaff(staffId: string, actor: { id: string; role: UserRole }, ownerId: string | null | undefined, ipAddress: string) {
    const user = await this.userRepository.findOne({ where: { id: staffId } });
    if (!user) throw new NotFoundException('Staff member not found');
    if (ownerId !== undefined && user.businessOwnerId !== ownerId) {
      throw new NotFoundException('Staff member not found');
    }
    if (user.role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('SUPER_ADMIN accounts cannot be deactivated here');
    user.isActive = false;
    await this.userRepository.save(user);
    await this.auditService.logAction({
      actionType: AuditActionType.STAFF_DEACTIVATED, actorId: actor.id, actorRole: actor.role,
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