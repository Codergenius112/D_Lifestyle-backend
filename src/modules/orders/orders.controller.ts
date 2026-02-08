import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
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

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async createOrder(
    @Body() body: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.orderService.createOrder(body.bookingId, user.id, body.items, ipAddress);
  }

  @Get('booking/:bookingId')
  @Roles(UserRole.CUSTOMER, UserRole.WAITER, UserRole.MANAGER)
  async getOrdersByBooking(@Param('bookingId') bookingId: string) {
    return this.orderService.getOrdersByBooking(bookingId);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.WAITER, UserRole.MANAGER)
  async getOrder(@Param('id') orderId: string) {
    return { orderId };
  }

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
