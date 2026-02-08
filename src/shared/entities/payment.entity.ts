import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { PaymentStatus } from '../enums';
import { User } from './user.entity';
import { Booking } from './booking.entity';

@Entity('payment_transactions')
@Index('idx_payments_booking_id', ['bookingId'])
@Index('idx_payments_user_id', ['userId'])
@Index('idx_payments_status', ['status'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.payments)
  booking: Booking;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod: string; // 'wallet', 'paystack', 'external'

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalRefId: string; // Paystack reference

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
