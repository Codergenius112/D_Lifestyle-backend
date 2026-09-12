import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { BusinessScope, BusinessStatus } from '../enums';

// ← NEW (multi-tenancy)
// A Business is the tenant boundary. One owner (User, role=admin) may own
// several Businesses; each Business is isolated from every other Business
// by default, whether or not they share the same owner. Commission and
// service charge are intentionally NOT present here — they are never
// business-overridable and always come from PlatformSettings (Super Admin
// only). See Zentra Multi-Tenancy PRD, sections 5.2 and 9.
@Entity('businesses')
@Index('idx_businesses_owner_id', ['ownerId'])
@Index('idx_businesses_status', ['status'])
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerId: string; // immutable after creation — the business owner

  @Column({ type: 'varchar', length: 200 })
  name: string;

  // A business may hold more than one scope at once (e.g. TABLE_CLUB +
  // EVENT_TICKETING under a single nightclub business).
  @Column({ type: 'simple-array' })
  businessScopes: BusinessScope[];

  @Column({ type: 'enum', enum: BusinessStatus, default: BusinessStatus.PENDING })
  status: BusinessStatus;

  @Column({ type: 'jsonb', nullable: true })
  payoutDetails: Record<string, any> | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
