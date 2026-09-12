import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../../shared/entities/inventory-item.entity';
import { InventoryTransaction } from '../../shared/entities/inventory-transaction.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { AuditModule } from '../audit/audit.module';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, InventoryTransaction]), AuditModule],
  providers: [InventoryService, BusinessContextService], // ← CHANGED (multi-tenancy)
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}