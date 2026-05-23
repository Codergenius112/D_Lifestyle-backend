import {
  Controller, Get, Post, Body, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { WalletService } from './wallet.service';
import { UserRole } from '../../shared/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialLedger } from '../../shared/entities/financial-ledger.entity';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private walletService: WalletService,
    @InjectRepository(FinancialLedger)
    private ledgerRepository: Repository<FinancialLedger>,
  ) {}

  /**
   * GET /wallet
   * Returns the authenticated user's wallet.
   * Auto-creates wallet if one doesn't exist yet.
   */
  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)
  async getWallet(@CurrentUser() user: any) {
    return this.walletService.getWallet(user.id);
  }

  /**
   * GET /wallet/transactions
   * Returns ledger entries (credits and debits) newest first.
   * WalletScreen maps these to the transaction history list.
   */
  @Get('transactions')
  @Roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)
  async getTransactions(@CurrentUser() user: any) {
    const entries = await this.ledgerRepository.find({
      where: { relatedUserId: user.id },
      order: { timestamp: 'DESC' },
      take: 50,
    });

    const normalised = entries.map((e) => ({
      id:              e.id,
      transactionType: e.transactionType,
      amount:          Number(e.amount),
      description:     e.description,
      createdAt:       e.timestamp,
    }));

    return { entries: normalised, total: normalised.length };
  }

  /**
   * POST /wallet/fund
   * Called after a successful Paystack payment to credit the wallet.
   * Body: { amount, paystackReference }
   */
  @Post('fund')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async fundWallet(
    @Body() body: { amount: number; paystackReference: string },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    if (!body.amount || body.amount <= 0) {
      return { success: false, message: 'Invalid amount' };
    }

    const wallet = await this.walletService.credit(
      user.id,
      Number(body.amount),
      `Wallet top-up via Paystack (ref: ${body.paystackReference})`,
      ipAddress,
    );

    return {
      success: true,
      balance: Number(wallet.balance),
      message: `₦${Number(body.amount).toLocaleString()} added to your wallet`,
    };
  }
}