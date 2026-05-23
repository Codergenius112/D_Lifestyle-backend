import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('group_bookings')
@Index('idx_group_booking_id', ['bookingId'])
@Index('idx_group_initiator_id', ['initiatorId'])
export class GroupBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'uuid' })
  initiatorId: string;

  @Column({ type: 'simple-array' })
  participantIds: string[]; // Array of user IDs

  @Column({ type: 'jsonb' })
  contributionTracker: Record<string, number>; // {userId: amountPaid}

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalRequired: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPaid: number;

  @Column({ type: 'timestamp' })
  countdownExpiresAt: Date; // 8 minutes from creation

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}