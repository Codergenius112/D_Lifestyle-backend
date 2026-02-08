import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Booking } from '../../shared/entities/booking.entity';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { FinancialLedger } from '../../shared/entities/financial-ledger.entity';

import {
  PaymentStatus,
  BookingStatus,
  AuditActionType,
} from '../../shared/enums';

import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,

    @InjectRepository(PaymentTransaction)
    private paymentRepository: Repository<PaymentTransaction>,

    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,

    @InjectRepository(FinancialLedger)
    private ledgerRepository: Repository<FinancialLedger>,

    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  private async getTotalPaidForBookingTx(
    bookingId: string,
    manager: any,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(PaymentTransaction, 'payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.bookingId = :bookingId', { bookingId })
      .andWhere('payment.status IN (:...statuses)', {
        statuses: [
          PaymentStatus.FULLY_PAID,
          PaymentStatus.PARTIALLY_PAID,
        ],
      })
      .getRawOne<{ total: string }>();

    return Number(result.total);
  }

  async processPayment(
    bookingId: string,
    userId: string,
    amount: number,
    method: 'wallet' | 'paystack',
    ipAddress: string,
  ): Promise<PaymentTransaction> {
    let savedPayment!: PaymentTransaction;

    await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
      });

      if (!booking) {
        throw new BadRequestException(
          `Booking ${bookingId} not found`,
        );
      }

      if (amount <= 0) {
        throw new BadRequestException(
          'Amount must be greater than 0',
        );
      }

      // Wallet payment (locked)
      if (method === 'wallet') {
        const wallet = await manager.findOne(Wallet, {
          where: { userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!wallet || wallet.balance < amount) {
          throw new BadRequestException(
            'Insufficient wallet balance',
          );
        }

        wallet.balance -= amount;
        wallet.lastTransactionAt = new Date();

        await manager.save(wallet);
      }

      const payment = manager.create(PaymentTransaction, {
        bookingId,
        userId,
        amount,
        paymentMethod: method,
        status: PaymentStatus.PARTIALLY_PAID,
        completedAt: new Date(),
      });

      savedPayment = await manager.save(payment);

      const alreadyPaid =
        await this.getTotalPaidForBookingTx(
          bookingId,
          manager,
        );

      const currentPaid = alreadyPaid + amount;

      if (currentPaid >= booking.totalAmount) {
        booking.paymentStatus = PaymentStatus.FULLY_PAID;
        booking.status = BookingStatus.CONFIRMED;
        payment.status = PaymentStatus.FULLY_PAID;
      } else {
        booking.paymentStatus =
          PaymentStatus.PARTIALLY_PAID;
      }

      booking.paymentMethod = method;

      await manager.save(booking);
      await manager.save(payment);

      const ledgerEntry = manager.create(
        FinancialLedger,
        {
          bookingId,
          transactionType: 'DEBIT',
          amount,
          description: `Payment for booking ${bookingId} via ${method}`,
          relatedUserId: userId,
        },
      );

      await manager.save(ledgerEntry);
    });

    // Audit logging OUTSIDE transaction
    await this.auditService.logAction({
      actionType: AuditActionType.PAYMENT_PROCESSED,
      actorId: userId,
      actorRole: user.role,
      resourceType: 'booking',
      resourceId: bookingId,
      changes: {
        amountPaid: amount,
        method,
        status: savedPayment.status,
      },
      ipAddress,
    });

    return savedPayment;
  }
}
