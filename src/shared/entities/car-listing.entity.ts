import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('car_listings')
@Index('idx_car_listings_active', ['isActive'])
@Index('idx_car_listings_city', ['city'])
export class CarListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  make: string;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ type: 'integer' })
  year: number;

  @Column({ type: 'varchar', length: 50 })
  color: string;

  @Column({ type: 'varchar', length: 20 })
  plateNumber: string;

  @Column({ type: 'varchar', length: 20 })
  transmission: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'integer' })
  seats: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  pricePerDay: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) // ← NEW
  cautionFee: number;

  @Column({ type: 'boolean', default: true }) // ← NEW
  cautionFeeRefundable: boolean;

  @Column({ type: 'simple-array', nullable: true }) // ← NEW
  unavailableDates: string[] | null;

  @Column({ type: 'uuid', nullable: true }) // ← NEW
  assignedDriverId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: '[]' })
  features: string[];

  @Column({ type: 'jsonb', default: '[]' })
  images: string[];

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'boolean', default: false })
  withDriver: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false }) // ← NEW
  isDeleted: boolean;

  @Column({ type: 'uuid', nullable: true })
  managedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}