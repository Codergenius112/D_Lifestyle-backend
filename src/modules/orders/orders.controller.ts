import {
  Controller, Get, Post, Patch,
  Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { OrderService } from './orders.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orderService: OrderService) {}

  // POST /orders
  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.WAITER)
  @HttpCode(201)
  async createOrder(
    @Body() body: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.createOrder(body.bookingId, user.id, body.items, ipAddress);
  }

  // GET /orders/my — must be BEFORE :id
  @Get('my')
  @Roles(UserRole.CUSTOMER)
  async getMyOrders(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orderService.getOrdersByUser(
      user.id,
      limit  ? Number(limit)  : 20,
      offset ? Number(offset) : 0,
    );
  }

  // GET /orders/booking/:bookingId — must be BEFORE :id
  @Get('booking/:bookingId')
  @Roles(UserRole.CUSTOMER, UserRole.WAITER, UserRole.MANAGER)
  async getOrdersByBooking(@Param('bookingId') bookingId: string) {
    return this.orderService.getOrdersByBooking(bookingId);
  }

  // GET /orders/:id
  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF, UserRole.MANAGER)
  async getOrder(@Param('id') orderId: string) {
    return this.orderService.getOrder(orderId);
  }

  // PATCH /orders/:id/status
  @Patch(':id/status')
  @Roles(UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF, UserRole.MANAGER)
  @HttpCode(200)
  async updateStatus(
    @Param('id') orderId: string,
    @Body() body: { status: string },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.updateOrderStatus(orderId, body.status as any, user.id, ipAddress);
  }

  // POST /orders/:id/assign
  @Post(':id/assign')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(200)
  async assignWaiter(
    @Param('id') orderId: string,
    @Body() body: { waiterId: string },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.assignOrderToWaiter(orderId, body.waiterId, user.id, ipAddress);
  }
}