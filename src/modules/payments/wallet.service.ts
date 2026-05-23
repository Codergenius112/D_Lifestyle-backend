import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Wallet } from '../../shared/entities/wallet.entity';
import { User } from '../../shared/entities/user.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  // ─── Internal helper: fetch wallet inside an existing transaction ──────────
  // Always uses pessimistic_write lock so concurrent requests queue up
  // rather than reading stale balances.
  private async getWalletLocked(
    userId: string,
    manager: EntityManager,
  ): Promise<Wallet> {
    const wallet = await manager.findOne(Wallet, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new BadRequestException(`Wallet not found for user ${userId}`);
    }

    return wallet;
  }

  // ─── Public: read-only wallet fetch (no lock needed) ──────────────────────
  async getWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({ where: { userId } });

    if (!wallet) {
      // Auto-create wallet if it doesn't exist (e.g. legacy users)
      wallet = this.walletRepository.create({
        userId,
        balance: 0,
        currency: 'NGN',
      });
      wallet = await this.walletRepository.save(wallet);
    }

    return wallet;
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    return wallet.balance;
  }

  // ─── DEBIT ────────────────────────────────────────────────────────────────
  async debit(
    userId: string,
    amount: number,
    reason: string,
    ipAddress?: string,
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const wallet = await this.getWalletLocked(userId, manager);

      if (wallet.balance < amount) {
        throw new BadRequestException(
          `Insufficient wallet balance. Available: ₦${wallet.balance}, Required: ₦${amount}`,
        );
      }

      wallet.balance = Number(wallet.balance) - amount;
      wallet.lastTransactionAt = new Date();

      return manager.save(wallet);
    });

    await this.auditService.logAction({
      actionType: 'WALLET_DEBIT' as any,
      actorId: userId,
      resourceType: 'wallet',
      resourceId: updated.id,
      changes: { debit: amount, balance: updated.balance, reason },
      ipAddress,
    });

    return updated;
  }

  // ─── CREDIT ───────────────────────────────────────────────────────────────
  async credit(
    userId: string,
    amount: number,
    reason: string,
    ipAddress?: string,
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const wallet = await this.getWalletLocked(userId, manager);

      wallet.balance = Number(wallet.balance) + amount;
      wallet.lastTransactionAt = new Date();

      return manager.save(wallet);
    });

    await this.auditService.logAction({
      actionType: 'WALLET_CREDIT' as any,
      actorId: userId,
      resourceType: 'wallet',
      resourceId: updated.id,
      changes: { credit: amount, balance: updated.balance, reason },
      ipAddress,
    });

    return updated;
  }

  // ─── TRANSFER ─────────────────────────────────────────────────────────────
  // Locks BOTH wallets inside a single transaction.
  // Wallets are always locked in a consistent order (by userId, alphabetically)
  // to prevent deadlocks when two transfers happen in opposite directions
  // simultaneously (A→B and B→A).
  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    // Deterministic lock order to prevent deadlocks
    const [firstId, secondId] =
      fromUserId < toUserId
        ? [fromUserId, toUserId]
        : [toUserId, fromUserId];

    let fromWalletId: string;

    await this.dataSource.transaction(async (manager) => {
      // Lock in consistent order
      const firstWallet  = await this.getWalletLocked(firstId, manager);
      const secondWallet = await this.getWalletLocked(secondId, manager);

      // Map back to sender/receiver regardless of lock order
      const fromWallet = firstId === fromUserId ? firstWallet : secondWallet;
      const toWallet   = firstId === fromUserId ? secondWallet : firstWallet;

      if (fromWallet.balance < amount) {
        throw new BadRequestException(
          `Insufficient balance for transfer. Available: ₦${fromWallet.balance}, Required: ₦${amount}`,
        );
      }

      fromWallet.balance = Number(fromWallet.balance) - amount;
      toWallet.balance   = Number(toWallet.balance)   + amount;

      fromWallet.lastTransactionAt = new Date();
      toWallet.lastTransactionAt   = new Date();

      await manager.save([fromWallet, toWallet]);

      fromWalletId = fromWallet.id;
    });

    await this.auditService.logAction({
      actionType: 'WALLET_TRANSFER' as any,
      actorId: fromUserId,
      resourceType: 'wallet',
      resourceId: fromWalletId!,
      changes: { transfer: amount, to: toUserId, reason },
      ipAddress,
    });
  }
}