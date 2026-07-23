import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

// Persisted record of a notification sent to a user — separate from the
// BullMQ/Redis job that actually delivers the push. The queue job is
// ephemeral (retries, then gets cleaned up); this table is what the app's
// "Activity" screen actually reads from, and survives regardless of whether
// the push itself succeeded, failed, or the user had no device token at all.
@Entity('notifications')
@Index('idx_notifications_user_id', ['userId'])
@Index('idx_notifications_user_read', ['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  // Drives the icon/color in the mobile Activity feed — booking/table/ride/
  // payment/promo/ticket. Free-text rather than a DB enum since new types
  // (e.g. a future "queue" notification) shouldn't need a migration to add.
  @Column({ type: 'varchar', length: 30, default: 'general' })
  type: string;

  // Optional deep-link payload — e.g. { bookingId: '...' } so tapping the
  // notification can navigate straight to the relevant screen.
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
