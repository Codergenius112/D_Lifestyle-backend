import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AuditLog } from '../../shared/entities/audit-log.entity';
import { AuditActionType, UserRole } from '../../shared/enums';

const MAX_LIMIT = 200;

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  // ================= LOG ACTION =================
  async logAction(logData: {
    actionType: AuditActionType;
    actorId: string;
    actorRole: UserRole;
    resourceType?: string;
    resourceId?: string;
    changes?: Record<string, any>;
    ipAddress?: string;
  }): Promise<AuditLog> {

    if (!logData.actorId) {
      throw new BadRequestException('Audit log must include actorId');
    }

    const previous = await this.auditRepository.findOne({
      order: { timestamp: 'DESC' },
    });

    const normalizedChanges = logData.changes
      ? JSON.parse(JSON.stringify(logData.changes))
      : null;

    const hashPayload = JSON.stringify({
      ...logData,
      changes: normalizedChanges,
      prevHash: previous?.hash || null,
    });

    const hash = createHash('sha256').update(hashPayload).digest('hex');

    const auditLog = this.auditRepository.create({
      actionType: logData.actionType,
      actorId: logData.actorId,
      actorRole: logData.actorRole,
      resourceType: logData.resourceType,
      resourceId: logData.resourceId,
      changes: normalizedChanges,
      ipAddress: logData.ipAddress,
      prevHash: previous?.hash || null,
      hash,
    });

    return this.auditRepository.save(auditLog);
  }

  // ================= AUDIT TRAIL =================
  async getAuditTrail(resourceId?: string, limit = 50, offset = 0) {
    limit = Math.min(limit, MAX_LIMIT);
    offset = Math.max(offset, 0);

    const query = this.auditRepository
      .createQueryBuilder('audit')
      .select([
        'audit.id',
        'audit.timestamp',
        'audit.actionType',
        'audit.actorId',
        'audit.actorRole',
        'audit.resourceType',
        'audit.resourceId',
        'audit.changes',
        'audit.ipAddress',
      ]);

    if (resourceId) {
      query.where('audit.resourceId = :resourceId', { resourceId });
    }

    return query
      .orderBy('audit.timestamp', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
  }

  // ================= ACTION HISTORY =================
  async getActionHistory(actionType: AuditActionType, limit = 100, offset = 0) {
    limit = Math.min(limit, MAX_LIMIT);
    offset = Math.max(offset, 0);

    return this.auditRepository.findAndCount({
      where: { actionType },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  // ================= VERIFY INTEGRITY =================
  async verifyIntegrity(): Promise<boolean> {
    const logs = await this.auditRepository.find({
      order: { timestamp: 'ASC' },
    });

    let prevHash: string | null = null;

    for (const log of logs) {
      const recalculated: string = createHash('sha256')
        .update(
          JSON.stringify({
            actionType: log.actionType,
            actorId: log.actorId,
            actorRole: log.actorRole,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            changes: log.changes,
            ipAddress: log.ipAddress,
            prevHash,
          }),
        )
        .digest('hex');

      if (recalculated !== log.hash) return false;
      prevHash = log.hash;
    }

    return true;
  }
}
