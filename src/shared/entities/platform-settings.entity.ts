import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';
import { CommissionPayer } from '../enums';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 400 })
  serviceCharge: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.03 })
  commissionRate: number;

  @Column({ type: 'enum', enum: CommissionPayer, default: CommissionPayer.USER })
  commissionPayer: CommissionPayer;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 5000 })
  pushNotificationFee: number;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}