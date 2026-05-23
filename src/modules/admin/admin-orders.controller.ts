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
import {
  UpdateOrderStatusDto,
  AssignOrderToWaiterDto,
  RouteOrderToStationDto,
} from '../../shared/dtos/order.dto';
import { UserRole } from '../../shared/enums';

@ApiTags('Admin - Orders Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private orderService: OrderService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List all orders' })
  async listAllOrders(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.orderService.getAllOrders(Number(limit), Number(offset));
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