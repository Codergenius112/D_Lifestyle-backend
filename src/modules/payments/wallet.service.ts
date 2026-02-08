import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async getWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({ where: { userId } });

    if (!wallet) {
      // Auto-create wallet if it doesn't exist
      wallet = new Wallet();
      wallet.userId = userId;
      wallet.balance = 0;
      wallet.currency = 'NGN';
      wallet = await this.walletRepository.save(wallet);
    }

    return wallet;
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    return wallet.balance;
  }

  async debit(
    userId: string,
    amount: number,
    reason: string,
    ipAddress?: string,
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ₦${wallet.balance}, Required: ₦${amount}`,
      );
    }

    wallet.balance -= amount;
    wallet.lastTransactionAt = new Date();

    const updated = await this.walletRepository.save(wallet);

    await this.auditService.logAction({
      actionType: 'WALLET_DEBIT' as any,
      actorId: userId,
      resourceType: 'wallet',
      resourceId: wallet.id,
      changes: { debit: amount, balance: updated.balance, reason },
      ipAddress,
    });

    return updated;
  }

  async credit(
    userId: string,
    amount: number,
    reason: string,
    ipAddress?: string,
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.getWallet(userId);

    wallet.balance += amount;
    wallet.lastTransactionAt = new Date();

    const updated = await this.walletRepository.save(wallet);

    await this.auditService.logAction({
      actionType: 'WALLET_CREDIT' as any,
      actorId: userId,
      resourceType: 'wallet',
      resourceId: wallet.id,
      changes: { credit: amount, balance: updated.balance, reason },
      ipAddress,
    });

    return updated;
  }

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

    const fromWallet = await this.getWallet(fromUserId);
    const toWallet = await this.getWallet(toUserId);

    if (fromWallet.balance < amount) {
      throw new BadRequestException('Insufficient balance for transfer');
    }

    fromWallet.balance -= amount;
    toWallet.balance += amount;

    fromWallet.lastTransactionAt = new Date();
    toWallet.lastTransactionAt = new Date();

    await this.walletRepository.save([fromWallet, toWallet]);

    await this.auditService.logAction({
      actionType: 'WALLET_TRANSFER' as any,
      actorId: fromUserId,
      resourceType: 'wallet',
      resourceId: fromWallet.id,
      changes: { transfer: amount, to: toUserId, reason },
      ipAddress,
    });
  }
}