import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User }             from '../../shared/entities/user.entity';
import { Booking }          from '../../shared/entities/booking.entity';
import { FinancialLedger }  from '../../shared/entities/financial-ledger.entity';
import { AuditLog }         from '../../shared/entities/audit-log.entity';
import { UserRole, AuditActionType, BookingStatus, PaymentStatus } from '../../shared/enums';
import { AuditService }     from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';

// ─── In-memory platform settings (loaded from .env on startup) ───────────────
// In v2: persist these in a platform_settings DB table so they survive restarts
const platformSettings = {
  serviceCharge:  parseFloat(process.env.SERVICE_CHARGE   ?? '400'),
  commissionRate: parseFloat(process.env.COMMISSION_RATE  ?? '3'),
};

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

  // ─── 1. Get platform settings ─────────────────────────────────────────────
  getPlatformSettings() {
    return {
      serviceCharge:  platformSettings.serviceCharge,
      commissionRate: platformSettings.commissionRate,
      currency:       'NGN',
    };
  }

  // ─── 2. Update service charge ─────────────────────────────────────────────
  async updateServiceCharge(newCharge: number, actorId: string, ipAddress: string) {
    if (newCharge < 0) throw new BadRequestException('Service charge cannot be negative');

    const old = platformSettings.serviceCharge;
    platformSettings.serviceCharge = newCharge;

    await this.auditService.logAction({
      actionType: AuditActionType.ADMIN_OVERRIDE, actorId,
      actorRole: UserRole.SUPER_ADMIN, resourceType: 'platform_settings',
      resourceId: 'service_charge', changes: { from: old, to: newCharge }, ipAddress,
    });

    return { message: `Service charge updated from ₦${old} to ₦${newCharge}`, serviceCharge: newCharge };
  }

  // ─── 3. Update commission rate ────────────────────────────────────────────
  async updateCommissionRate(newRate: number, actorId: string, ipAddress: string) {
    if (newRate < 0 || newRate > 100) throw new BadRequestException('Rate must be 0–100');

    const old = platformSettings.commissionRate;
    platformSettings.commissionRate = newRate;

    await this.auditService.logAction({
      actionType: AuditActionType.ADMIN_OVERRIDE, actorId,
      actorRole: UserRole.SUPER_ADMIN, resourceType: 'platform_settings',
      resourceId: 'commission_rate', changes: { from: old, to: newRate }, ipAddress,
    });

    return { message: `Commission rate updated from ${old}% to ${newRate}%`, commissionRate: newRate };
  }

  // ─── 4. Promote user to ADMIN ─────────────────────────────────────────────
  async promoteToAdmin(userId: string, actorId: string, ipAddress: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN) throw new BadRequestException('Cannot change another SUPER_ADMIN');
    if (user.role === UserRole.ADMIN) throw new BadRequestException('User is already an ADMIN');

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

  // ─── 5. Demote ADMIN to MANAGER ───────────────────────────────────────────
  async demoteAdmin(userId: string, actorId: string, ipAddress: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN) throw new BadRequestException('Cannot demote a SUPER_ADMIN');
    if (user.role !== UserRole.ADMIN) throw new BadRequestException('User is not an ADMIN');

    user.role = UserRole.MANAGER;
    const updated = await this.userRepository.save(user);

    await this.auditService.logAction({
      actionType: AuditActionType.USER_UPDATED, actorId, actorRole: UserRole.SUPER_ADMIN,
      resourceType: 'user', resourceId: userId,
      changes: { role: { from: UserRole.ADMIN, to: UserRole.MANAGER } }, ipAddress,
    });

    return updated;
  }

  // ─── 6. Override any booking ──────────────────────────────────────────────
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
      superAdminOverride: { by: actorId, reason, from: oldStatus, to: newStatus, at: new Date().toISOString() },
    };

    const updated = await this.bookingRepository.save(booking);

    await this.auditService.logAction({
      actionType: AuditActionType.ADMIN_OVERRIDE, actorId, actorRole: UserRole.SUPER_ADMIN,
      resourceType: 'booking', resourceId: bookingId,
      changes: { status: { from: oldStatus, to: newStatus }, reason }, ipAddress,
    });

    return updated;
  }

  // ─── 7. Full financial overview ───────────────────────────────────────────
  async getFinancialOverview(startDate: Date, endDate: Date) {
    const [revenue, dashboard, walletResult, refundResult, topupResult] = await Promise.all([
      this.analyticsService.getRevenueAnalytics(startDate, endDate),
      this.analyticsService.getDashboardMetrics(startDate, endDate),
      this.dataSource.query(`SELECT COALESCE(SUM(balance), 0) as total FROM wallets`),
      this.dataSource.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM financial_ledger
         WHERE transaction_type = 'CREDIT' AND description LIKE 'Refund%'
         AND timestamp BETWEEN $1 AND $2`, [startDate, endDate],
      ),
      this.dataSource.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM financial_ledger
         WHERE transaction_type = 'CREDIT' AND description LIKE 'Wallet top-up%'
         AND timestamp BETWEEN $1 AND $2`, [startDate, endDate],
      ),
    ]);

    return {
      period:           { startDate, endDate },
      revenue,
      dashboardRevenue: dashboard.revenue,
      wallets: {
        totalBalanceAcrossPlatform: parseFloat(walletResult[0]?.total ?? '0').toFixed(2),
        totalTopUps:                parseFloat(topupResult[0]?.total  ?? '0').toFixed(2),
        totalRefunds:               parseFloat(refundResult[0]?.total ?? '0').toFixed(2),
      },
      platformSettings: this.getPlatformSettings(),
    };
  }

  // ─── 8. Full audit log (all users, all actions) ───────────────────────────
  async getFullAuditLog(limit = 100, offset = 0, actorId?: string, actionType?: AuditActionType) {
    const query = this.auditRepository.createQueryBuilder('audit');
    if (actorId)    query.andWhere('audit.actorId = :actorId', { actorId });
    if (actionType) query.andWhere('audit.actionType = :actionType', { actionType });

    const [data, total] = await query
      .orderBy('audit.timestamp', 'DESC')
      .take(Math.min(limit, 500))
      .skip(offset)
      .getManyAndCount();

    return { data, total, limit, offset };
  }

  // ─── 9. Verify audit log integrity ────────────────────────────────────────
  async verifyAuditIntegrity() {
    const isValid = await this.auditService.verifyIntegrity();
    return {
      intact:  isValid,
      message: isValid
        ? 'Audit log chain is intact — no tampering detected'
        : '⚠️ Audit log integrity FAILED — possible tampering detected',
    };
  }

  // ─── 10. Platform user stats ──────────────────────────────────────────────
  async getUserStats() {
    const [total, customers, admins, active] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.CUSTOMER } }),
      this.userRepository.count({ where: { role: UserRole.ADMIN } }),
      this.userRepository.count({ where: { isActive: true } }),
    ]);

    return {
      total,
      customers,
      admins,
      staff:    total - customers - admins,
      active,
      inactive: total - active,
    };
  }
}