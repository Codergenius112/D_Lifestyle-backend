import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TableCategory } from '../enums';

@Entity('table_listings')
@Index('idx_table_listings_venue_id', ['venueId'])
@Index('idx_table_listings_category', ['category'])
@Index('idx_table_listings_is_active', ['isActive'])
export class TableListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  venueId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: TableCategory, default: TableCategory.STANDARD })
  category: TableCategory;

  @Column({ type: 'integer' })
  capacity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  features: string[]; // e.g. ['Bottle service', 'Dance floor view', 'Private area']

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}