import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards, HttpCode, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessIds, ActiveBusinessId, BusinessScopes } from '../../common/decorators/business-context.decorator'; // ← CHANGED (scope fix)
import {
  InventoryService, CreateInventoryItemDto, UpdateInventoryItemDto, StockActionDto,
} from './inventory.service';
import { InventoryCategory } from '../../shared/entities/inventory-item.entity';
import { BusinessScope, UserRole } from '../../shared/enums';
import { effectiveOwnerId } from '../../shared/utils/business-scope.util';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: "Create inventory item, owned by the caller's own business" })
  createItem(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: any, @ActiveBusinessId() activeBusinessId?: string | null) {
    if (!activeBusinessId) {
      throw new BadRequestException(
        'Could not determine which business this item belongs to. If you manage more than one business, specify one via the X-Business-Id header.',
      );
    }
    return this.inventoryService.createItem(dto, user.id, activeBusinessId, effectiveOwnerId(user));
  }

  @Get('items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List inventory items — scoped to the caller's business(es) unless super admin" })
  getItems(
    @CurrentUser() user: any,
    @Query('businessScope') businessScope?: BusinessScope,
    @Query('venueId') venueId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
    @BusinessScopes() businessScopes?: BusinessScope[], // ← CHANGED (scope fix)
  ) {
    return this.inventoryService.getItems({
      businessScope,
      allowedScopes: businessScopes, // ← CHANGED (scope fix): from the resolved business(es), not user.businessScopes
      venueId,
      lowStockOnly: lowStockOnly === 'true',
      limit: limit ? +limit : 50,
      offset: offset ? +offset : 0,
      businessIds,
    });
  }

  @Patch('items/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Update inventory item metadata, within one of the caller's own business(es)" })
  updateItem(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.inventoryService.updateItem(id, dto, user.id, businessIds);
  }

  @Post('items/:id/restock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: "Restock an inventory item, within one of the caller's own business(es)" })
  restock(@Param('id') id: string, @Body() dto: StockActionDto, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    const reason = dto?.reason ?? 'Reason not provided'
    return this.inventoryService.restock(id, dto.quantity, reason, user.id, user.role, businessIds);
  }
  @Post('items/:id/deduct')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF)
  @HttpCode(200)
  @ApiOperation({ summary: "Deduct stock from an inventory item, within one of the caller's own business(es)" })
  deduct(@Param('id') id: string, @Body() dto: StockActionDto, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    let categoryRestriction: InventoryCategory | undefined;
    const reason = dto?.reason ?? 'Reason not provided'
    if (user.role === UserRole.KITCHEN_STAFF) categoryRestriction = InventoryCategory.KITCHEN_INGREDIENT;
    if (user.role === UserRole.BAR_STAFF) categoryRestriction = InventoryCategory.BAR_STOCK;
    return this.inventoryService.deduct(id, dto.quantity, reason, user.id, user.role, categoryRestriction, businessIds);
  }

  @Get('items/:id/history')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Get transaction history for an item, within one of the caller's own business(es)" })
  getHistory(@Param('id') id: string, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.inventoryService.getTransactionHistory(id, businessIds);
  }

  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Get all low-stock items — scoped to the caller's business(es) unless super admin" })
  getLowStock(
    @CurrentUser() user: any, @Query('businessScope') businessScope?: BusinessScope,
    @BusinessIds() businessIds?: string[], @BusinessScopes() businessScopes?: BusinessScope[],
  ) {
    return this.inventoryService.getLowStockItems(
      businessScope,
      businessScopes, // ← CHANGED (scope fix)
      businessIds,
    );
  }
}
