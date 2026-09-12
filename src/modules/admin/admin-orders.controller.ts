import {
  Controller, Get, Patch, Post,
  Body, Param, UseGuards, HttpCode, Query, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { BusinessIds } from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy)
import { OrderService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { bookingTypesForUser } from '../../shared/utils/business-scope.util';
import {
  UpdateOrderStatusDto,
  AssignOrderToWaiterDto,
  RouteOrderToStationDto,
} from '../../shared/dtos/order.dto';
import { UserRole } from '../../shared/enums';
import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ManualPurchaseLineDto {
  @IsString() itemId: string;
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
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private orderService: OrderService,
    private readonly inventoryService: InventoryService,
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
    @BusinessIds() businessIds?: string[], // ← NEW (multi-tenancy)
  ) {
    const targetCount = [dto.bookingId, dto.venueId, dto.eventId].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException('Select exactly one of a table, a venue, or an event for this purchase.');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Add at least one item to the purchase.');
    }

    // ← CHANGED (multi-tenancy): inventory items are now scoped by
    // businessId the same as everything else in this pass.
    const resolvedItems = [];
    for (const line of dto.items) {
      const invItem = await this.inventoryService.getItem(line.itemId, businessIds);
      resolvedItems.push({
        itemId: invItem.id,
        name: invItem.name,
        quantity: line.quantity,
        price: Number(invItem.sellingPrice),
        specialInstructions: line.specialInstructions,
      });
    }

    // businessId for the order itself IS resolved from bookingId/venueId/
    // eventId directly inside OrderService.createOrder (and its suspended-
    // business freeze check runs there too).
    const order = await this.orderService.createOrder(
      { bookingId: dto.bookingId, venueId: dto.venueId, eventId: dto.eventId },
      user.id,
      resolvedItems,
      ipAddress,
    );

    for (const line of resolvedItems) {
      await this.inventoryService.deduct(
        line.itemId,
        line.quantity,
        `Manual purchase — order ${order.id}`,
        user.id,
        user.role,
        undefined,
        businessIds,
      );
    }

    return order;
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List orders — scoped to the caller\'s business(es) unless super admin' })
  async listAllOrders(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: any,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    // Frontend sends bare dates like "2026-08-15" for both start and end.
    // Interpreted literally, "2026-08-15" means midnight — so an end date
    // of today would exclude every order from today. Bump endDate to the
    // last instant of that calendar day so the whole day is included.
    const normalizedEndDate = endDate && endDate.length === 10
      ? `${endDate}T23:59:59.999`
      : endDate;

    return this.orderService.getAllOrders(
      Number(limit),
      Number(offset),
      bookingTypesForUser(user),
      businessIds,
      startDate,
      normalizedEndDate,
    );
  }

  @Get('live')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF)
  @ApiOperation({ summary: 'Live orders dashboard — scoped to the caller\'s own business(es)' })
  async getLiveOrders(
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    return this.orderService.getLiveOrders(bookingTypesForUser(user), businessIds);
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