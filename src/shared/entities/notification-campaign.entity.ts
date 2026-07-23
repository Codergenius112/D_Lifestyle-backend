import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';
import { BusinessScope } from '../enums';

@Entity('notification_campaigns')
export class NotificationCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 50 })
  targetScope: BusinessScope | 'ALL';

  @Column({ type: 'uuid', nullable: true })
  tierId: string | null;

  // Snapshotted from the tier at send time — editing a tier's price/cap
  // later must never rewrite what a past campaign actually charged/reached.
  @Column({ type: 'integer', nullable: true })
  tierMaxRecipients: number | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: 'DRAFT' | 'SENT' | 'FAILED';

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  recipientCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  feePaid: number;

  @Column({ type: 'varchar', length: 20, default: 'UNPAID' })
  paymentStatus: 'PAID' | 'UNPAID';

  @CreateDateColumn()
  createdAt: Date;
}