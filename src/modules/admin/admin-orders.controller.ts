import {
  Controller, Get, Patch, Post,
  Body, Param, UseGuards, HttpCode, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { OrderService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { bookingTypesForUser } from '../../shared/utils/business-scope.util';
import {
  UpdateOrderStatusDto,
  AssignOrderToWaiterDto,
  RouteOrderToStationDto,
} from '../../shared/dtos/order.dto';
import { UserRole } from '../../shared/enums';
import { IsString, IsOptional, IsNumber, Min, IsArray } from 'class-validator';

class ManualPurchaseItemDto {
  @IsOptional() @IsString() itemId?: string;
  @IsString() name: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() specialInstructions?: string;
}

class ManualPurchaseDto {
  @IsString() bookingId: string;
  @IsArray() items: ManualPurchaseItemDto[];
  @IsOptional() @IsString() inventoryItemId?: string;
  @IsOptional() @IsNumber() @Min(1) inventoryQuantity?: number;
  @IsOptional() @IsString() inventoryReason?: string;
}

@ApiTags('Admin - Orders Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private orderService: OrderService,
    private readonly inventoryService: InventoryService,
  ) {}

  @Post('manual-purchase')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.BAR_STAFF, UserRole.KITCHEN_STAFF, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Record a manual purchase (items) against an existing booking/table, with optional inventory deduction' })
  async recordManualPurchase(
    @Body() dto: ManualPurchaseDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    const order = await this.orderService.createOrder(
      dto.bookingId,
      user.id,
      dto.items,
      ipAddress,
    );

    if (dto.inventoryItemId && dto.inventoryQuantity) {
      await this.inventoryService.deduct(
        dto.inventoryItemId,
        Number(dto.inventoryQuantity),
        dto.inventoryReason ?? 'Manual purchase',
        user.id,
        user.role,
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
    return this.orderService.getAllOrders(
      Number(limit),
      Number(offset),
      bookingTypesForUser(user),
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