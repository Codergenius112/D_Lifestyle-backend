import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { AuditActionType, UserRole } from '../enums';

@Entity('audit_logs')
@Index('idx_audit_resource_id', ['resourceId'])
@Index('idx_audit_timestamp', ['timestamp'])
@Index('idx_audit_action_type', ['actionType'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditActionType })
  actionType: AuditActionType;

  @Column({ type: 'uuid', nullable: true })
  actorId: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  actorRole?: UserRole;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceType: string;

  @Column({ type: 'uuid', nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  timestamp: Date;
  
  @Column({ type: 'varchar', nullable: true })
  prevHash: string | null;

  @Column({ type: 'varchar' })
  hash: string;
}