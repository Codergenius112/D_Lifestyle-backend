import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('queues')
@Index('idx_queue_venue_id', ['venueId'])
@Index('idx_queue_user_id', ['userId'])
@Index('idx_queue_status', ['status'])
export class Queue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  venueId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'varchar', length: 50, default: 'WAITING' })
  status: string; // WAITING, CALLED, CHECKED_IN, CANCELLED

  @Column({ type: 'timestamp', nullable: true })
  calledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkedInAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}