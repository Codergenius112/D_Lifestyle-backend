import { Controller, Post, Get, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { PaymentService } from './payments.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentService: PaymentService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async processPayment(
    @Body() body: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.paymentService.processPayment(
      body.bookingId,
      user.id,
      body.amount,
      body.method,
      ipAddress,
    );
  }

  @Post('refund')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async refundPayment(
    @Body() body: { paymentId: string },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.paymentService.refundPayment(body.paymentId, user.id, ipAddress);
  }

  @Get('transaction/:id')
  @Roles(UserRole.CUSTOMER)
  async getTransaction(@Param('id') transactionId: string) {
    return { transactionId };
  }
}
