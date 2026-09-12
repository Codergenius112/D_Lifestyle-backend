import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../../shared/entities/audit-log.entity';
import { User } from '../../shared/entities/user.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, User]),
  ],
  providers: [AuditService, BusinessContextService], // ← CHANGED (multi-tenancy)
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
