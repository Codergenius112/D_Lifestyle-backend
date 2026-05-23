import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking }            from '../../shared/entities/booking.entity';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { Wallet }             from '../../shared/entities/wallet.entity';
import { FinancialLedger }    from '../../shared/entities/financial-ledger.entity';
import { User }               from '../../shared/entities/user.entity';
import { PaymentService }            from './payments.service';
import { PaystackService }           from './paystack.service';
import { WalletService }             from './wallet.service';
import { PaymentsController }        from './payments.controller';
import { WalletController }          from './wallet.controller';
import { PaystackWebhookController } from './paystack-webhook.controller';
import { AuditModule }               from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, PaymentTransaction, Wallet, FinancialLedger, User]),
    AuditModule,
  ],
  providers:   [PaymentService, PaystackService, WalletService],
  controllers: [PaymentsController, WalletController, PaystackWebhookController],
  exports:     [PaymentService, PaystackService, WalletService],
})
export class PaymentsModule {}