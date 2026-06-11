import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, Index,
} from 'typeorm';
import { BookingStatus, BookingType, PaymentStatus } from '../enums';
import { User } from './user.entity';
import { PaymentTransaction } from './payment.entity';

@Entity('bookings')
@Index('idx_bookings_user_id', ['userId'])
@Index('idx_bookings_type', ['bookingType'])
@Index('idx_bookings_status', ['status'])
@Index('idx_bookings_group_id', ['groupId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BookingType })
  bookingType: BookingType;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.bookings)
  user: User;

  @Column({ type: 'uuid', nullable: true })
  groupId: string;

  @Column({ type: 'uuid' })
  resourceId: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.INITIATED })
  status: BookingStatus;

  @Column({ type: 'integer', nullable: true })
  guestCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformCommission: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  serviceCharge: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  paymentStatus: PaymentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod: string;

  // ← NEW: QR code fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  qrCodeData: string | null;

  @Column({ type: 'timestamp', nullable: true })
  scannedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  scannedBy: string | null;

  // ← NEW: Caution fee fields
  @Column({ type: 'varchar', length: 20, default: 'HELD' })
  cautionFeeStatus: 'HELD' | 'REFUNDED' | 'FORFEITED';

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cautionFeeAmount: number;

  @Column({ type: 'timestamp', nullable: true })
  cautionFeeResolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cautionFeeResolvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  checkInTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false }) // ← NEW
  isDeleted: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => PaymentTransaction, (payment) => payment.booking)
  payments: PaymentTransaction[];
}