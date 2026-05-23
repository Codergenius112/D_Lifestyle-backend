import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('events')
@Index('idx_events_venue_id', ['venueId'])
@Index('idx_events_status',   ['status'])
@Index('idx_events_start_date', ['startDate'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  /**
   * venueId is a plain string key (e.g. 'venue-skylounge')
   * — not a FK so we don't need a venues table yet.
   */
  @Column({ type: 'varchar', length: 100 })
  venueId: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'integer', default: 0 })
  capacity: number;

  /** Array of DJ names */
  @Column({ type: 'jsonb', default: [] })
  djs: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  genre: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dresscode: string | null;

  /** active | cancelled | completed */
  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  ticketPrice: number;

  @Column({ type: 'jsonb', default: [] })
  images: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}