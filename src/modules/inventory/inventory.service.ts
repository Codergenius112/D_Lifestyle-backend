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
  @IsEnum(BusinessScope) businessScope: BusinessScope;
  @IsOptional() @IsUUID() venueId?: string;
}

export class UpdateInventoryItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() @Min(0) lowStockThreshold?: number;
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

  async createItem(dto: CreateInventoryItemDto, adminId: string): Promise<InventoryItem> {
    const item = this.itemRepo.create(dto);
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

  async updateItem(id: string, dto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const item = await this.findItemOrThrow(id);
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async restock(
    itemId: string, quantity: number, reason: string, actorId: string, actorRole: UserRole,
  ): Promise<InventoryTransaction> {
    const item = await this.findItemOrThrow(itemId);
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
    categoryRestriction?: InventoryCategory,
  ): Promise<InventoryTransaction> {
    const item = await this.findItemOrThrow(itemId);

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
    businessScope?: BusinessScope; venueId?: string; lowStockOnly?: boolean;
    limit?: number; offset?: number;
  }) {
    const qb = this.itemRepo.createQueryBuilder('i').where('i.isDeleted = false');
    if (filters.businessScope) qb.andWhere('i.businessScope = :s', { s: filters.businessScope });
    if (filters.venueId) qb.andWhere('i.venueId = :v', { v: filters.venueId });
    if (filters.lowStockOnly) qb.andWhere('i.currentStock <= i.lowStockThreshold');
    qb.take(filters.limit ?? 50).skip(filters.offset ?? 0);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getLowStockItems(businessScope?: BusinessScope) {
    const qb = this.itemRepo.createQueryBuilder('i')
      .where('i.isDeleted = false')
      .andWhere('i.currentStock <= i.lowStockThreshold');
    if (businessScope) qb.andWhere('i.businessScope = :s', { s: businessScope });
    return qb.getMany();
  }

  async getTransactionHistory(itemId: string) {
    return this.txRepo.find({
      where: { itemId },
      order: { createdAt: 'DESC' },
    });
  }

  private async findItemOrThrow(id: string): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { id, isDeleted: false } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }
}