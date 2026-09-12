import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { UserRole, BusinessScope } from '../enums';

// ← NEW (multi-tenancy)
// Replaces the flat User.businessOwnerId / User.businessScopes columns for
// staff who may need access to more than one Business. A staff member's
// effective access is the union of their active (non-revoked) assignments —
// they only ever see the business(es) named here. This is also the sole
// mechanism for "cross-business staff visibility": granting a staff member
// access to a second business is just adding a second assignment row.
// See Zentra Multi-Tenancy PRD, section 6.
@Entity('staff_business_assignments')
@Index('idx_sba_user_id', ['userId'])
@Index('idx_sba_business_id', ['businessId'])
@Index('idx_sba_user_business_active', ['userId', 'businessId', 'revokedAt'])
export class StaffBusinessAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string; // the staff member

  @Column({ type: 'uuid' })
  businessId: string;

  // The staff member's role within THIS business (may differ per assignment,
  // e.g. Manager at Business A, Waiter at Business B).
  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  // Optional narrower scope within the business (e.g. only EVENT_TICKETING),
  // null means "all of this business's scopes".
  @Column({ type: 'simple-array', nullable: true })
  scopes: BusinessScope[] | null;

  @Column({ type: 'uuid' })
  assignedBy: string; // the owner (or delegate) who created this assignment

  @CreateDateColumn()
  assignedAt: Date;

  // Soft-revoke: keep the row for audit history, just stop honouring it.
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
