import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('financial_ledger')
@Index('idx_ledger_booking_id', ['bookingId'])
@Index('idx_ledger_timestamp', ['timestamp'])
@Index('idx_ledger_user_id', ['relatedUserId'])
export class FinancialLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string;

  @Column({ type: 'varchar', length: 20 })
  transactionType: 'DEBIT' | 'CREDIT';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid', nullable: true })
  relatedUserId: string;

  @CreateDateColumn()
  timestamp: Date;
}