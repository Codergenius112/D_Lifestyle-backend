import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem, InventoryCategory } from '../../shared/entities/inventory-item.entity';
import { InventoryTransaction, TransactionType } from '../../shared/entities/inventory-transaction.entity';
import { AuditService } from '../audit/audit.service';
import { AuditActionType, BusinessScope, BusinessShareDataType, UserRole } from '../../shared/enums';
import { IsString, IsNumber, IsEnum, IsOptional, IsUUID, Min } from 'class-validator';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

export class CreateInventoryItemDto {
  @IsString() name: string;
  @IsString() sku: string;
  @IsEnum(InventoryCategory) category: InventoryCategory;
  @IsString() unit: string;
  @IsNumber() @Min(0) currentStock: number;
  @IsNumber() @Min(0) lowStockThreshold: number;
  @IsOptional() @IsNumber() @Min(0) sellingPrice?: number;
  @IsEnum(BusinessScope) businessScope: BusinessScope;
  @IsOptional() @IsUUID() venueId?: string;
}

export class UpdateInventoryItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) currentStock?: number;
  @IsOptional() @IsNumber() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsNumber() @Min(0) sellingPrice?: number;
  @IsOptional() isActive?: boolean;
}

export class StockActionDto {
  @IsNumber() @Min(1) quantity: number;
  @IsOptional() @IsString() reason?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly txRepo: Repository<InventoryTransaction>,
    private readonly auditService: AuditService,
    private readonly businessContext: BusinessContextService, // ← NEW (multi-tenancy)
  ) {}

  async createItem(dto: CreateInventoryItemDto, adminId: string, businessId?: string | null, ownerId?: string | null): Promise<InventoryItem> {
    const item = this.itemRepo.create({ ...dto, ownerId: ownerId ?? adminId, businessId: businessId ?? null });
    const saved = await this.itemRepo.save(item);
    await this.auditService.logAction({
      actionType: AuditActionType.INVENTORY_ITEM_CREATED,
      actorId: adminId,
      resourceType: 'inventory_item',
      resourceId: saved.id,
      resourceName: saved.name,
      changes: { after: dto },
    });
    return saved;
  }

  async updateItem(
    id: string,
    dto: UpdateInventoryItemDto,
    actorId: string,
    businessIds?: string[],
  ): Promise<InventoryItem> {
    const item = await this.findItemOrThrow(id, businessIds);
    await this.businessContext.assertBusinessActive((item as any).businessId); // ← NEW (multi-tenancy)
    await this.businessContext.assertWriteAccess((item as any).businessId, businessIds, actorId, BusinessShareDataType.INVENTORY); // ← NEW (Phase 5)
    const before = {
      name: item.name,
      unit: item.unit,
      currentStock: item.currentStock,
      lowStockThreshold: item.lowStockThreshold,
      sellingPrice: item.sellingPrice,
      isActive: (item as any).isActive,
    };

    Object.assign(item, dto);
    const saved = await this.itemRepo.save(item);

    await this.auditService.logAction({
      actionType: AuditActionType.INVENTORY_ITEM_UPDATED,
      actorId,
      resourceType: 'inventory_item',
      resourceId: saved.id,
      resourceName: saved.name,
      changes: { before, after: dto },
    });

    return saved;
  }

  async restock(
    itemId: string, quantity: number, reason: string, actorId: string, actorRole: UserRole,
    businessIds?: string[],
  ): Promise<InventoryTransaction> {
    const item = await this.findItemOrThrow(itemId, businessIds);
    await this.businessContext.assertBusinessActive((item as any).businessId); // ← NEW (multi-tenancy)
    await this.businessContext.assertWriteAccess((item as any).businessId, businessIds, actorId, BusinessShareDataType.INVENTORY); // ← NEW (Phase 5)
    const before = item.currentStock;
    item.currentStock += quantity;
    await this.itemRepo.save(item);

    const tx = this.txRepo.create({
      itemId, type: TransactionType.RESTOCK,
      quantity, balanceBefore: before, balanceAfter: item.currentStock,
      reason, performedBy: actorId, performedByRole: actorRole,
    });
    const saved = await this.txRepo.save(tx);

    await this.auditService.logAction({
      actionType: AuditActionType.INVENTORY_RESTOCKED,
      actorId, resourceType: 'inventory_item', resourceId: itemId,
      resourceName: item.name,
      changes: { quantity, balanceBefore: before, balanceAfter: item.currentStock },
    });

    return saved;
  }

  async deduct(
    itemId: string, quantity: number, reason: string, actorId: string, actorRole: UserRole,
    categoryRestriction?: InventoryCategory, businessIds?: string[],
  ): Promise<InventoryTransaction> {
    const item = await this.findItemOrThrow(itemId, businessIds);
    await this.businessContext.assertBusinessActive((item as any).businessId); // ← NEW (multi-tenancy)
    await this.businessContext.assertWriteAccess((item as any).businessId, businessIds, actorId, BusinessShareDataType.INVENTORY); // ← NEW (Phase 5)

    if (categoryRestriction && item.category !== categoryRestriction) {
      throw new ForbiddenException('You can only deduct stock for your station category.');
    }

    if (item.currentStock < quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${item.currentStock}`);
    }

    const before = item.currentStock;
    item.currentStock -= quantity;
    await this.itemRepo.save(item);

    const tx = this.txRepo.create({
      itemId, type: TransactionType.DEDUCTION,
      quantity: -quantity, balanceBefore: before, balanceAfter: item.currentStock,
      reason, performedBy: actorId, performedByRole: actorRole,
    });
    const saved = await this.txRepo.save(tx);

    await this.auditService.logAction({
      actionType: AuditActionType.INVENTORY_DEDUCTED,
      actorId, resourceType: 'inventory_item', resourceId: itemId,
      resourceName: item.name,
      changes: { quantity, balanceBefore: before, balanceAfter: item.currentStock },
    });

    return saved;
  }

  async getItems(filters: {
    businessScope?: BusinessScope; allowedScopes?: BusinessScope[]; venueId?: string; lowStockOnly?: boolean;
    limit?: number; offset?: number; businessIds?: string[];
  }) {
    if (filters.businessIds && filters.businessIds.length === 0) return { data: [], total: 0 };

    // ← NEW (Phase 5) — reads see the caller's own inventory PLUS whatever's
    // been actively shared in from another of their businesses.
    const readableIds = filters.businessIds
      ? await this.businessContext.resolveReadableBusinessIds(filters.businessIds, BusinessShareDataType.INVENTORY)
      : undefined;

    const qb = this.itemRepo.createQueryBuilder('i').where('i.isDeleted = false');
    if (filters.allowedScopes) {
      qb.andWhere('i.businessScope IN (:...scopes)', { scopes: filters.allowedScopes.length ? filters.allowedScopes : ['__none__'] });
    } else if (filters.businessScope) {
      qb.andWhere('i.businessScope = :s', { s: filters.businessScope });
    }
    if (readableIds) qb.andWhere('i."businessId" IN (:...businessIds)', { businessIds: readableIds.length ? readableIds : ['__none__'] });
    if (filters.venueId) qb.andWhere('i.venueId = :v', { v: filters.venueId });
    if (filters.lowStockOnly) qb.andWhere('i.currentStock <= i.lowStockThreshold');
    qb.take(filters.limit ?? 50).skip(filters.offset ?? 0);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getLowStockItems(businessScope?: BusinessScope, allowedScopes?: BusinessScope[], businessIds?: string[]) {
    if (businessIds && businessIds.length === 0) return [];

    // ← NEW (Phase 5)
    const readableIds = businessIds
      ? await this.businessContext.resolveReadableBusinessIds(businessIds, BusinessShareDataType.INVENTORY)
      : undefined;

    const qb = this.itemRepo.createQueryBuilder('i')
      .where('i.isDeleted = false')
      .andWhere('i.currentStock <= i.lowStockThreshold');
    if (allowedScopes) {
      qb.andWhere('i.businessScope IN (:...scopes)', { scopes: allowedScopes.length ? allowedScopes : ['__none__'] });
    } else if (businessScope) {
      qb.andWhere('i.businessScope = :s', { s: businessScope });
    }
    if (readableIds) qb.andWhere('i."businessId" IN (:...businessIds)', { businessIds: readableIds.length ? readableIds : ['__none__'] });
    return qb.getMany();
  }

  async getTransactionHistory(itemId: string, businessIds?: string[]) {
    await this.findItemOrThrow(itemId, businessIds);

    const rows = await this.txRepo.createQueryBuilder('tx')
      .leftJoin('users', 'u', 'u.id = tx."performedBy"')
      .addSelect(['u.firstName AS "performedByFirstName"',
                  'u.lastName  AS "performedByLastName"',
                  'u.role      AS "performedByRole2"'])
      .where('tx."itemId" = :itemId', { itemId })
      .orderBy('tx."createdAt"', 'DESC')
      .getRawMany();

    return rows.map(r => ({
      id:              r.tx_id,
      itemId:          r.tx_itemId,
      type:            r.tx_type,
      quantity:        r.tx_quantity,
      balanceBefore:   r.tx_balanceBefore,
      balanceAfter:    r.tx_balanceAfter,
      reason:          r.tx_reason,
      performedBy:     r.tx_performedBy,
      performedByRole: r.tx_performedByRole,
      createdAt:       r.tx_createdAt,
      performedByUser: r.performedByFirstName
        ? { firstName: r.performedByFirstName,
            lastName:  r.performedByLastName,
            role:      r.performedByRole2 }
        : null,
    }));
  }

  async getItem(id: string, businessIds?: string[]): Promise<InventoryItem> {
    return this.findItemOrThrow(id, businessIds);
  }

  // ← CHANGED (Phase 5): "readable" now includes items shared in from
  // another of the caller's businesses, not just items they directly own —
  // see BusinessContextService.resolveReadableBusinessIds. Write-time
  // Manager-only enforcement for shared items happens separately, in each
  // write method below (findItemOrThrow alone only governs visibility).
  private async findItemOrThrow(id: string, businessIds?: string[]): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { id, isDeleted: false } });
    if (!item) throw new NotFoundException('Inventory item not found');
    if (businessIds !== undefined) {
      const readableIds = await this.businessContext.resolveReadableBusinessIds(businessIds, BusinessShareDataType.INVENTORY);
      if (!readableIds || !readableIds.length || !readableIds.includes((item as any).businessId)) {
        throw new NotFoundException('Inventory item not found');
      }
    }
    return item;
  }
}