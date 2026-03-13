import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
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

  /** JSON array of amenity strings e.g. ["WiFi", "Pool", "AC"] */
  @Column({ type: 'jsonb', default: '[]' })
  amenities: string[];

  /** JSON array of image URL strings */
  @Column({ type: 'jsonb', default: '[]' })
  images: string[];

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