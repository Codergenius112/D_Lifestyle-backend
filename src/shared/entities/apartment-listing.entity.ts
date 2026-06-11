import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('apartment_listings')
@Index('idx_apartment_listings_active', ['isActive'])
@Index('idx_apartment_listings_city', ['city'])
export class ApartmentListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  pricePerNight: number;

  @Column({ type: 'integer' })
  bedrooms: number;

  @Column({ type: 'integer' })
  bathrooms: number;

  @Column({ type: 'integer' })
  maxGuests: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) // ← NEW
  cautionFee: number;

  @Column({ type: 'boolean', default: true }) // ← NEW
  cautionFeeRefundable: boolean;

  @Column({ type: 'text', nullable: true }) // ← NEW
  houseRules: string | null;

  @Column({ type: 'simple-array', nullable: true }) // ← NEW
  unavailableDates: string[] | null;

  @Column({ type: 'jsonb', default: '[]' })
  amenities: string[];

  @Column({ type: 'jsonb', default: '[]' })
  images: string[];

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