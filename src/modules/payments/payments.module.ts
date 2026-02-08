import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../shared/entities/booking.entity';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { FinancialLedger } from '../../shared/entities/financial-ledger.entity';
import { PaymentService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, PaymentTransaction, Wallet, FinancialLedger]),
    AuditModule,
  ],
  providers: [PaymentService],
  controllers: [PaymentsController],
  exports: [PaymentService],
})
export class PaymentsModule {}