import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';
import { BusinessShareDataType } from '../enums';

// ← NEW (multi-tenancy)
// Owner-controlled grant letting one of the owner's own businesses expose
// specific data domains to another of the owner's own businesses. Both
// businesses MUST share the same ownerId — enforced at the service layer,
// not just here — a business can never share with one it doesn't co-own.
//
// Write access to shared data is Manager-role-only; every other staff role
// sees shared data read-only. That check is enforced by TenantScopeGuard at
// request time using the caller's StaffBusinessAssignment.role, not stored
// on this entity. See Zentra Multi-Tenancy PRD, section 7.
@Entity('business_data_shares')
@Index('idx_bds_from_business', ['fromBusinessId'])
@Index('idx_bds_to_business', ['toBusinessId'])
@Index('idx_bds_active', ['fromBusinessId', 'toBusinessId', 'revokedAt'])
export class BusinessDataShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  fromBusinessId: string; // the business whose data is being exposed

  @Column({ type: 'uuid' })
  toBusinessId: string; // the business receiving read (and Manager-only write) access

  @Column({ type: 'simple-array' })
  dataTypes: BusinessShareDataType[];

  @Column({ type: 'uuid' })
  grantedBy: string; // must be the shared owner of both businesses

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string | null;
}
