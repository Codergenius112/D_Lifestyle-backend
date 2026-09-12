import {
  Controller, Get, Post, Patch,
  Body, Param, Query, UseGuards, HttpCode, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy — orders gap fix)
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { BusinessIds } from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy — orders gap fix)
import { OrderService } from './orders.service';
import { BookingService } from '../bookings/bookings.service'; // ← NEW (multi-tenancy — orders gap fix)
import { UserRole } from '../../shared/enums';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy — orders gap fix)
@Controller('orders')
export class OrdersController {
  constructor(
    private orderService: OrderService,
    private readonly bookingService: BookingService, // ← NEW (multi-tenancy — orders gap fix)
  ) {}

  // POST /orders
  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.WAITER)
  @HttpCode(201)
  async createOrder(
    @Body() body: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.createOrder(
      { bookingId: body.bookingId },
      user.id,
      body.items,
      ipAddress,
      body.locationData, // tableInfo or pickupLocation
    );
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
  async getOrdersByBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    // ← FIXED (multi-tenancy — orders gap fix) — previously NO scoping at
    // all. Customers resolve to an EMPTY businessIds array (they don't own
    // or get assigned to any business), so filtering by businessIds for
    // them would incorrectly hide their own orders — instead, verify they
    // own the underlying BOOKING; staff get the usual business-membership
    // filter.
    if (user.role === UserRole.CUSTOMER) {
      const booking = await this.bookingService.getBooking(bookingId);
      if ((booking as any).userId !== user.id) return [];
      return this.orderService.getOrdersByBooking(bookingId);
    }
    return this.orderService.getOrdersByBooking(bookingId, businessIds);
  }

  // GET /orders/:id
  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF, UserRole.MANAGER)
  async getOrder(
    @Param('id') orderId: string,
    @CurrentUser() user: any,
    @BusinessIds() businessIds?: string[],
  ) {
    // ← FIXED (multi-tenancy — orders gap fix) — previously NO ownership
    // check at all: any customer could view any other customer's order,
    // and any staff member from any business could view any order on the
    // entire platform. Same bug pattern as tickets/tables/bookings.
    const order = await this.orderService.getOrder(orderId);
    if (user.role === UserRole.CUSTOMER) {
      if ((order as any).userId !== user.id) throw new NotFoundException(`Order ${orderId} not found`);
    } else if (businessIds !== undefined) {
      const orderBusinessId = (order as any).businessId;
      if (!businessIds.length || !orderBusinessId || !businessIds.includes(orderBusinessId)) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
    }
    return order;
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
    @BusinessIds() businessIds?: string[], // ← NEW (multi-tenancy — orders gap fix)
  ) {
    return this.orderService.updateOrderStatus(orderId, body.status as any, user.id, ipAddress, businessIds);
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
    @BusinessIds() businessIds?: string[], // ← NEW (multi-tenancy — orders gap fix)
  ) {
    return this.orderService.assignOrderToWaiter(orderId, body.waiterId, user.id, ipAddress, businessIds);
  }
}