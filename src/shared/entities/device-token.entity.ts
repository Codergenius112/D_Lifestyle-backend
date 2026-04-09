import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('device_tokens')
@Index('idx_device_tokens_user_id', ['userId'])
@Index('idx_device_tokens_token',   ['token'], { unique: true })
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /**
   * FCM registration token from Expo / Firebase.
   * Unique because the same physical token should never be stored twice.
   */
  @Column({ type: 'text', unique: true })
  token: string;

  /**
   * 'expo' | 'fcm' | 'apns'
   * Right now we only handle Expo push tokens, but this lets us expand later.
   */
  @Column({ type: 'varchar', length: 20, default: 'expo' })
  platform: string;

  /** Set to false when FCM reports the token as invalid so we stop sending to it. */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}