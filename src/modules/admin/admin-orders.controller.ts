import {
  Controller, Get, Patch, Post,
  Body, Param, UseGuards, HttpCode, Query, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { OrderService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { bookingTypesForUser, effectiveOwnerId } from '../../shared/utils/business-scope.util';
import { OwnershipResolverService } from '../../shared/services/ownership-resolver.service';
import {
  UpdateOrderStatusDto,
  AssignOrderToWaiterDto,
  RouteOrderToStationDto,
} from '../../shared/dtos/order.dto';
import { UserRole } from '../../shared/enums';
import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ManualPurchaseLineDto {
  @IsString() itemId: string; // inventory item id — required, price/name come from inventory
  @IsNumber() @Min(1) quantity: number;
  @IsOptional() @IsString() specialInstructions?: string;
}

class ManualPurchaseDto {
  @IsOptional() @IsString() bookingId?: string;
  @IsOptional() @IsString() venueId?: string;
  @IsOptional() @IsString() eventId?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualPurchaseLineDto)
  items: ManualPurchaseLineDto[];
}

@ApiTags('Admin - Orders Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private orderService: OrderService,
    private readonly inventoryService: InventoryService,
    private readonly ownershipResolver: OwnershipResolverService,
  ) {}

  @Post('manual-purchase')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.BAR_STAFF, UserRole.KITCHEN_STAFF)
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Record a manual purchase against a booking, venue, or event (table is optional). ' +
      'Items are looked up from inventory — price and name are never trusted from the client. ' +
      'Every item is automatically deducted from stock; there is no separate deduction toggle.',
  })
  async recordManualPurchase(
    @Body() dto: ManualPurchaseDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    const targetCount = [dto.bookingId, dto.venueId, dto.eventId].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException('Select exactly one of a table, a venue, or an event for this purchase.');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Add at least one item to the purchase.');
    }

    // Resolve each line against live inventory — price and name always come
    // from the inventory record, never from the client, so a purchase can't
    // be recorded at a stale or tampered price. Scoped to the caller's own
    // business so staff can't manually-purchase against another business's
    // stock by guessing an inventory item id.
    const ownerId = effectiveOwnerId(user);
    const resolvedItems = [];
    for (const line of dto.items) {
      const invItem = await this.inventoryService.getItem(line.itemId, ownerId);
      resolvedItems.push({
        itemId: invItem.id,
        name: invItem.name,
        quantity: line.quantity,
        price: Number(invItem.sellingPrice),
        specialInstructions: line.specialInstructions,
      });
    }

    const order = await this.orderService.createOrder(
      { bookingId: dto.bookingId, venueId: dto.venueId, eventId: dto.eventId },
      user.id,
      resolvedItems,
      ipAddress,
    );

    // Deduct every purchased item from stock automatically. If any item runs
    // short, later items in the same purchase won't be deducted — but the
    // order itself has already been recorded, so a partial-stock failure
    // surfaces as a clear error without silently losing the sale record.
    for (const line of resolvedItems) {
      await this.inventoryService.deduct(
        line.itemId,
        line.quantity,
        `Manual purchase — order ${order.id}`,
        user.id,
        user.role,
        undefined,
        ownerId,
      );
    }

    return order;
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List orders — scoped to the caller\'s business unless super admin' })
  async listAllOrders(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @CurrentUser() user: any,
  ) {
    const ownerId = effectiveOwnerId(user);
    let owned;
    if (ownerId !== undefined) {
      if (ownerId === null) return { orders: [], total: 0 };
      owned = await this.ownershipResolver.getOwnedResourceIds(ownerId);
    }
    return this.orderService.getAllOrders(
      Number(limit),
      Number(offset),
      bookingTypesForUser(user),
      owned,
    );
  }

  @Get('live')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF)
  @ApiOperation({ summary: 'Live orders dashboard' })
  async getLiveOrders() {
    return this.orderService.getLiveOrders();
  }

  @Get('by-station/:stationId')
  @Roles(UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF, UserRole.MANAGER)
  async getStationOrders(@Param('stationId') stationId: string) {
    return this.orderService.getOrdersByStation(stationId);
  }

  @Get('by-waiter/:waiterId')
  @Roles(UserRole.WAITER, UserRole.MANAGER)
  async getWaiterOrders(@Param('waiterId') waiterId: string) {
    return this.orderService.getOrdersByAssignedWaiter(waiterId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF)
  @HttpCode(200)
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.updateOrderStatus(orderId, dto.status as any, user.id, ipAddress);
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  async assignWaiter(
    @Param('id') orderId: string,
    @Body() dto: AssignOrderToWaiterDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.assignOrderToWaiter(orderId, dto.waiterId, user.id, ipAddress);
  }

  @Post(':id/route')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  async routeOrder(
    @Param('id') orderId: string,
    @Body() dto: RouteOrderToStationDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.routeOrderToStation(orderId, dto.stationId, user.id, ipAddress);
  }
}