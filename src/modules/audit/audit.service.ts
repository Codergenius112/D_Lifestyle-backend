import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AuditLog } from '../../shared/entities/audit-log.entity';
import { AuditActionType, UserRole } from '../../shared/enums';

const MAX_LIMIT = 200;

export interface LogActionInput {
  actionType: AuditActionType;
  actorId?: string;          // optional (SYSTEM fallback)
  actorRole?: UserRole;      // optional
  resourceType?: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  // ================= LOG ACTION =================
  async logAction(logData: LogActionInput): Promise<AuditLog> {
    if (!logData.actionType) {
      throw new BadRequestException('Audit log must include actionType');
    }

    const actorId = logData.actorId ?? 'SYSTEM';

    const previous = await this.auditRepository.findOne({
      select: ['hash'],
      order: { timestamp: 'DESC' },
    });

    const normalizedChanges = logData.changes
      ? this.normalizeObject(logData.changes)
      : undefined;

    const payload = {
      actionType: logData.actionType,
      actorId,
      actorRole: logData.actorRole,
      resourceType: logData.resourceType,
      resourceId: logData.resourceId,
      changes: normalizedChanges,
      ipAddress: logData.ipAddress,
      prevHash: previous?.hash,
    };

    const hash = this.generateHash(payload);

    const auditLog: AuditLog = this.auditRepository.create({
      ...payload,
      hash,
    });

    return this.auditRepository.save(auditLog);
  }

  // ================= AUDIT TRAIL =================
  async getAuditTrail(
    resourceId?: string,
    limit = 50,
    offset = 0,
  ): Promise<{
    data: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }> {
    limit = Math.min(Number(limit), MAX_LIMIT);
    offset = Math.max(Number(offset), 0);

    const query = this.auditRepository.createQueryBuilder('audit');

    if (resourceId) {
      query.where('audit.resourceId = :resourceId', { resourceId });
    }

    const [data, total] = await query
      .orderBy('audit.timestamp', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { data, total, limit, offset };
  }

  // ================= ACTION HISTORY =================
  async getActionHistory(
    actionType: AuditActionType,
    limit = 100,
    offset = 0,
  ): Promise<{
    data: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }> {
    limit = Math.min(Number(limit), MAX_LIMIT);
    offset = Math.max(Number(offset), 0);

    const [data, total] = await this.auditRepository.findAndCount({
      where: { actionType },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total, limit, offset };
  }

  // ================= VERIFY INTEGRITY =================
  async verifyIntegrity(): Promise<boolean> {
    const logs = await this.auditRepository.find({
      order: { timestamp: 'ASC' },
    });

    let prevHash: string | undefined = undefined;

    for (const log of logs) {
      const recalculated = this.generateHash({
        actionType: log.actionType,
        actorId: log.actorId,
        actorRole: log.actorRole,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        changes: log.changes,
        ipAddress: log.ipAddress,
        prevHash,
      });

      if (recalculated !== log.hash) {
        return false;
      }

      prevHash = log.hash;
    }

    return true;
  }

  // ================= HASH HELPERS =================

  private generateHash(payload: Record<string, any>): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private normalizeObject(obj: Record<string, any>) {
    return JSON.parse(JSON.stringify(obj));
  }
}
