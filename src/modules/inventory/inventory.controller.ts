import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  InventoryService, CreateInventoryItemDto, UpdateInventoryItemDto, StockActionDto,
} from './inventory.service';
import { InventoryCategory } from '../../shared/entities/inventory-item.entity';
import { BusinessScope, UserRole } from '../../shared/enums';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create inventory item' })
  createItem(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: any) {
    return this.inventoryService.createItem(dto, user.id);
  }

  @Get('items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF)
  @ApiOperation({ summary: 'List inventory items' })
  getItems(
    @Query('businessScope') businessScope?: BusinessScope,
    @Query('venueId') venueId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.inventoryService.getItems({
      businessScope,
      venueId,
      lowStockOnly: lowStockOnly === 'true',
      limit: limit ? +limit : 50,
      offset: offset ? +offset : 0,
    });
  }

  @Patch('items/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update inventory item metadata' })
  updateItem(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.updateItem(id, dto);
  }

  @Post('items/:id/restock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Restock an inventory item' })
  restock(@Param('id') id: string, @Body() dto: StockActionDto, @CurrentUser() user: any) {
    const reason = dto?.reason ?? 'Reason not provided'
    return this.inventoryService.restock(id, dto.quantity, reason, user.id, user.role);
  }
  @Post('items/:id/deduct')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF)
  @HttpCode(200)
  @ApiOperation({ summary: 'Deduct stock from an inventory item' })
  deduct(@Param('id') id: string, @Body() dto: StockActionDto, @CurrentUser() user: any) {
    let categoryRestriction: InventoryCategory | undefined;
    const reason = dto?.reason ?? 'Reason not provided'
    if (user.role === UserRole.KITCHEN_STAFF) categoryRestriction = InventoryCategory.KITCHEN_INGREDIENT;
    if (user.role === UserRole.BAR_STAFF) categoryRestriction = InventoryCategory.BAR_STOCK;
    return this.inventoryService.deduct(id, dto.quantity, reason, user.id, user.role, categoryRestriction);
  }

  @Get('items/:id/history')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get transaction history for an item' })
  getHistory(@Param('id') id: string) {
    return this.inventoryService.getTransactionHistory(id);
  }

  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all low-stock items' })
  getLowStock(@Query('businessScope') businessScope?: BusinessScope) {
    return this.inventoryService.getLowStockItems(businessScope);
  }
}