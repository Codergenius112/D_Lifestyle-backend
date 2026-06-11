import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User }            from '../../shared/entities/user.entity';
import { Booking }         from '../../shared/entities/booking.entity';
import { FinancialLedger } from '../../shared/entities/financial-ledger.entity';
import { AuditLog }        from '../../shared/entities/audit-log.entity';
import { UserRole, AuditActionType, BookingStatus, BusinessScope } from '../../shared/enums';
import { AuditService }     from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class SuperAdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,

    @InjectRepository(FinancialLedger)
    private ledgerRepository: Repository<FinancialLedger>,

    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,

    private auditService: AuditService,
    private analyticsService: AnalyticsService,
    private dataSource: DataSource,
  ) {}

  async listAllUsers(params: {
    limit: number; offset: number; role?: UserRole; search?: string;
  }) {
    const qb = this.userRepository.createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.firstName', 'u.lastName', 'u.role',
               'u.isActive', 'u.businessScopes', 'u.createdAt', 'u.lastLoginAt'])
      .where('u.isDeleted = false');

    if (params.role) qb.andWhere('u.role = :role', { role: params.role });
    if (params.search) {
      qb.andWhere(
        '(u.email ILIKE :s OR u.firstName ILIKE :s OR u.lastName ILIKE :s)',
        { s: `%${params.search}%` },
      );
    }

    qb.take(params.limit).skip(params.offset).orderBy('u.createdAt', 'DESC');
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async updateUserScopes(
    userId: string, scopes: BusinessScope[], actorId: string, ipAddress: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const before = user.businessScopes;
    user.businessScopes = scopes.length > 0 ? scopes : null;
    await this.userRepository.save(user);

    await this.auditService.logAction({
      actionType: AuditActionType.STAFF_SCOPE_UPDATED,
      actorId, actorRole: UserRole.SUPER_ADMIN,
      resourceType: 'user', resourceId: userId,
      changes: { before: { businessScopes: before }, after: { businessScopes: scopes } },
      ipAddress,
    });

    return { message: 'Scopes updated', businessScopes: user.businessScopes };
  }

  async promoteToAdmin(userId: string, actorId: string, ipAddress: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('Cannot change another SUPER_ADMIN');
    if (user.role === UserRole.ADMIN)
      throw new BadRequestException('User is already an ADMIN');

    const oldRole = user.role;
    user.role = UserRole.ADMIN;
    const updated = await this.userRepository.save(user);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED, actorId, actorRole: UserRole.SUPER_ADMIN,
      resourceType: 'user', resourceId: userId,
      changes: { role: { from: oldRole, to: UserRole.ADMIN } }, ipAddress,
    });

    return updated;
  }

  async demoteAdmin(userId: string, actorId: string, ipAddress: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('Cannot demote a SUPER_ADMIN');

    const oldRole = user.role;
    user.role = UserRole.CUSTOMER;
    await this.userRepository.save(user);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED, actorId,
      actorRole: UserRole.SUPER_ADMIN, resourceType: 'user', resourceId: userId,
      changes: { before: { role: oldRole }, after: { role: UserRole.CUSTOMER } },
      ipAddress,
    });

    return { message: 'User demoted to CUSTOMER', userId };
  }

  async overrideBookingStatus(
    bookingId: string, newStatus: BookingStatus,
    reason: string, actorId: string, ipAddress: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const oldStatus = booking.status;
    booking.status  = newStatus;
    if (newStatus === BookingStatus.CANCELLED) booking.cancelledAt = new Date();

    booking.metadata = {
      ...booking.metadata,
      superAdminOverride: {
        by: actorId, reason,
        from: oldStatus, to: newStatus,
        at: new Date().toISOString(),
      },
    };

    const updated = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.ADMIN_OVERRIDE, actorId, actorRole: UserRole.SUPER_ADMIN,
      resourceType: 'booking', resourceId: bookingId,
      changes: { status: { from: oldStatus, to: newStatus }, reason }, ipAddress,
    });

    return updated;
  }

  async getPlatformFinancials(startDate?: Date, endDate?: Date) {
    const end   = endDate   ?? new Date();
    const start = startDate ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [revenue, walletResult] = await Promise.all([
      this.analyticsService.getRevenueAnalytics(start, end),
      this.dataSource.query(`SELECT COALESCE(SUM(balance), 0) as total FROM wallets`),
    ]);

    return {
      period: { startDate: start, endDate: end },
      revenue,
      wallets: {
        totalBalanceAcrossPlatform: parseFloat(walletResult[0]?.total ?? '0').toFixed(2),
      },
    };
  }

  async getUserStats() {
    const [total, customers, admins, active] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.CUSTOMER } }),
      this.userRepository.count({ where: { role: UserRole.ADMIN } }),
      this.userRepository.count({ where: { isActive: true } }),
    ]);

    return {
      total, customers, admins,
      staff: total - customers - admins,
      active, inactive: total - active,
    };
  }

  async getAuditLogs(params: {
    limit: number; offset: number; action?: string;
    resourceType?: string; startDate?: Date; endDate?: Date;
  }) {
    const qb = this.auditRepository.createQueryBuilder('a').orderBy('a.timestamp', 'DESC');
    if (params.action)       qb.andWhere('a.actionType = :action', { action: params.action });
    if (params.resourceType) qb.andWhere('a.resourceType = :rt', { rt: params.resourceType });
    if (params.startDate)    qb.andWhere('a.timestamp >= :s', { s: params.startDate });
    if (params.endDate)      qb.andWhere('a.timestamp <= :e', { e: params.endDate });
    qb.take(params.limit).skip(params.offset);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async verifyAuditIntegrity() {
    const isValid = await this.auditService.verifyIntegrity();
    return {
      intact: isValid,
      message: isValid
        ? 'Audit log chain is intact — no tampering detected'
        : '⚠️ Audit log integrity FAILED — possible tampering detected',
    };
  }
}