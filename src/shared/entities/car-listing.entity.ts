import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('car_listings')
@Index('idx_car_listings_active', ['isActive'])
@Index('idx_car_listings_city', ['city'])
export class CarListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  make: string; // e.g. "Toyota"

  @Column({ type: 'varchar', length: 100 })
  model: string; // e.g. "Camry"

  @Column({ type: 'integer' })
  year: number;

  @Column({ type: 'varchar', length: 50 })
  color: string;

  @Column({ type: 'varchar', length: 20 })
  plateNumber: string;

  @Column({ type: 'varchar', length: 20 })
  transmission: string; // 'automatic' | 'manual'

  @Column({ type: 'varchar', length: 50 })
  category: string; // 'sedan' | 'suv' | 'luxury' | 'van'

  @Column({ type: 'integer' })
  seats: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  pricePerDay: number;

  @Column({ type: 'text' })
  description: string;

  /** JSON array of feature strings e.g. ["AC", "Bluetooth", "GPS"] */
  @Column({ type: 'jsonb', default: '[]' })
  features: string[];

  /** JSON array of image URL strings */
  @Column({ type: 'jsonb', default: '[]' })
  images: string[];

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  /** Whether a driver is included */
  @Column({ type: 'boolean', default: false })
  withDriver: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Optional: manager/admin who manages this listing */
  @Column({ type: 'uuid', nullable: true })
  managedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}