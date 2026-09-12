import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from '../../shared/entities/queue.entity';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy — queues gap fix)

@Module({
  imports: [TypeOrmModule.forFeature([Queue]), AuditModule, NotificationsModule],
  providers: [QueuesService, BusinessContextService], // ← CHANGED (multi-tenancy — queues gap fix)
  controllers: [QueuesController],
  exports: [QueuesService],
})
export class QueuesModule {}