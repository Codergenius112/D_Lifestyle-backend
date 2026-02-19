import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
} from 'typeorm';

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
import { UserRole } from '../../shared/enums';


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
    manager: EntityManager,
  ): Promise<number> {
    const result = (await manager
      .createQueryBuilder(PaymentTransaction, 'payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.bookingId = :bookingId', { bookingId })
      .andWhere('payment.status IN (:...statuses)', {
        statuses: [
          PaymentStatus.FULLY_PAID,
          PaymentStatus.PARTIALLY_PAID,
        ],
      })
      .getRawOne()) as { total: string };

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

    await this.dataSource.transaction(
      async (manager: EntityManager) => {
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
          booking.paymentStatus =
            PaymentStatus.FULLY_PAID;
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
      },
    );

    await this.auditService.logAction({
      actionType:
        AuditActionType.PAYMENT_PROCESSED,
      actorId: userId,
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

  // =========================
  // REFUND PAYMENT (FIXED)
  // =========================
  async refundPayment(
  paymentId: string,
  actorId: string,
  ipAddress?: string,
): Promise<PaymentTransaction> {
  return this.dataSource.transaction(
    async (manager: EntityManager) => {

      const payment = await manager.findOne(
        PaymentTransaction,
        { where: { id: paymentId } },
      );

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Already refunded
      if (payment.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException('Payment already refunded');
      }

      // Not refundable
      const refundableStatuses = [
        PaymentStatus.FULLY_PAID,
        PaymentStatus.PARTIALLY_PAID,
      ];

      if (!refundableStatuses.includes(payment.status)) {
        throw new BadRequestException(
          'This payment cannot be refunded',
        );
      }

      //  Lock wallet
      const wallet = await manager.findOne(Wallet, {
        where: { userId: payment.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new BadRequestException('Wallet not found');
      }

      // 💰 Credit wallet back
      wallet.balance += payment.amount;
      wallet.lastTransactionAt = new Date();
      await manager.save(wallet);

      // 🧾 Create ledger entry
      const ledger = manager.create(FinancialLedger, {
        bookingId: payment.bookingId,
        transactionType: 'CREDIT',
        amount: payment.amount,
        description: `Refund for payment ${payment.id}`,
        relatedUserId: payment.userId,
      });

      await manager.save(ledger);

      // 🔄 Update payment status
      payment.status = PaymentStatus.REFUNDED;
      const updatedPayment = await manager.save(payment);

      // ============================
      //  Recalculate Booking State
      // ============================

      const booking = await manager.findOne(Booking, {
        where: { id: payment.bookingId },
      });

      if (booking) {
        const totalPaid =
          await this.getTotalPaidForBookingTx(
            booking.id,
            manager,
          );

        if (totalPaid <= 0) {
          booking.paymentStatus = PaymentStatus.UNPAID;
          booking.status = BookingStatus.PENDING_PAYMENT; // or whatever your default is
        } else if (totalPaid < booking.totalAmount) {
          booking.paymentStatus = PaymentStatus.PARTIALLY_PAID;
          booking.status = BookingStatus.PENDING_PAYMENT;
        } else {
          booking.paymentStatus = PaymentStatus.FULLY_PAID;
          booking.status = BookingStatus.CONFIRMED;
        }

        await manager.save(booking);
      }

      // 🧾 Audit log
      await this.auditService.logAction({
      actionType: AuditActionType.PAYMENT_REFUNDED,
      actorId,
      actorRole: UserRole.ADMIN,
      resourceType: 'payment',
      resourceId: payment.id,
      changes: { status: PaymentStatus.REFUNDED },
      ipAddress,
      });

    return updatedPayment;
  },
);
}
}