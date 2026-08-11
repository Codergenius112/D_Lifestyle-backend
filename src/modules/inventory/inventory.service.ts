import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem, InventoryCategory } from '../../shared/entities/inventory-item.entity';
import { InventoryTransaction, TransactionType } from '../../shared/entities/inventory-transaction.entity';
import { AuditService } from '../audit/audit.service';
import { AuditActionType, BusinessScope, UserRole } from '../../shared/enums';
import { IsString, IsNumber, IsEnum, IsOptional, IsUUID, Min } from 'class-validator';

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
  ) {}

  async createItem(dto: CreateInventoryItemDto, adminId: string, ownerId?: string | null): Promise<InventoryItem> {
    const item = this.itemRepo.create({ ...dto, ownerId: ownerId ?? adminId });
    const saved = await this.itemRepo.save(item);
    await this.auditService.logAction({
      actionType: AuditActionType.INVENTORY_ITEM_CREATED,
      actorId: adminId,
      resourceType: 'inventory_item',
      resourceId: saved.id,
      changes: { after: dto },
    });
    return saved;
  }

  async updateItem(id: string, dto: UpdateInventoryItemDto, ownerId?: string | null): Promise<InventoryItem> {
    const item = await this.findItemOrThrow(id, ownerId);
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async restock(
    itemId: string, quantity: number, reason: string, actorId: string, actorRole: UserRole,
    ownerId?: string | null,
  ): Promise<InventoryTransaction> {
    const item = await this.findItemOrThrow(itemId, ownerId);
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
      changes: { quantity, balanceBefore: before, balanceAfter: item.currentStock },
    });

    return saved;
  }

  async deduct(
    itemId: string, quantity: number, reason: string, actorId: string, actorRole: UserRole,
    categoryRestriction?: InventoryCategory, ownerId?: string | null,
  ): Promise<InventoryTransaction> {
    const item = await this.findItemOrThrow(itemId, ownerId);

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
      changes: { quantity, balanceBefore: before, balanceAfter: item.currentStock },
    });

    return saved;
  }

  async getItems(filters: {
    businessScope?: BusinessScope; allowedScopes?: BusinessScope[]; venueId?: string; lowStockOnly?: boolean;
    limit?: number; offset?: number; ownerId?: string | null;
  }) {
    if (filters.ownerId === null) return { data: [], total: 0 };

    const qb = this.itemRepo.createQueryBuilder('i').where('i.isDeleted = false');
    // allowedScopes (derived from the caller's role) always wins over the
    // caller-supplied businessScope query param, so a scoped admin can't
    // request another business's inventory by changing the query string.
    if (filters.allowedScopes) {
      qb.andWhere('i.businessScope IN (:...scopes)', { scopes: filters.allowedScopes.length ? filters.allowedScopes : ['__none__'] });
    } else if (filters.businessScope) {
      qb.andWhere('i.businessScope = :s', { s: filters.businessScope });
    }
    if (filters.ownerId) qb.andWhere('i."ownerId" = :ownerId', { ownerId: filters.ownerId });
    if (filters.venueId) qb.andWhere('i.venueId = :v', { v: filters.venueId });
    if (filters.lowStockOnly) qb.andWhere('i.currentStock <= i.lowStockThreshold');
    qb.take(filters.limit ?? 50).skip(filters.offset ?? 0);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getLowStockItems(businessScope?: BusinessScope, allowedScopes?: BusinessScope[], ownerId?: string | null) {
    if (ownerId === null) return [];

    const qb = this.itemRepo.createQueryBuilder('i')
      .where('i.isDeleted = false')
      .andWhere('i.currentStock <= i.lowStockThreshold');
    if (allowedScopes) {
      qb.andWhere('i.businessScope IN (:...scopes)', { scopes: allowedScopes.length ? allowedScopes : ['__none__'] });
    } else if (businessScope) {
      qb.andWhere('i.businessScope = :s', { s: businessScope });
    }
    if (ownerId) qb.andWhere('i."ownerId" = :ownerId', { ownerId });
    return qb.getMany();
  }

  async getTransactionHistory(itemId: string, ownerId?: string | null) {
    // Verifies the item belongs to the caller's business before returning
    // its history — reuses the same ownership check as everything else.
    await this.findItemOrThrow(itemId, ownerId);

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

  async getItem(id: string, ownerId?: string | null): Promise<InventoryItem> {
    return this.findItemOrThrow(id, ownerId);
  }

  private async findItemOrThrow(id: string, ownerId?: string | null): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { id, isDeleted: false } });
    if (!item) throw new NotFoundException('Inventory item not found');
    if (ownerId !== undefined && item.ownerId !== ownerId) {
      throw new NotFoundException('Inventory item not found');
    }
    return item;
  }
}