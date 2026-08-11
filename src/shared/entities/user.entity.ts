import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
  OneToOne, OneToMany,
} from 'typeorm';
import { UserRole, BusinessScope } from '../enums';
import { Wallet } from './wallet.entity';
import { Booking } from './booking.entity';
import { Order } from './order.entity';

@Entity('users')
@Index('idx_users_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false }) // ← NEW
  isDeleted: boolean;

  @Column({ type: 'simple-array', nullable: true }) // ← NEW
  businessScopes: BusinessScope[] | null;

  // For staff (Manager/Waiter/Bar/Kitchen/Door), points at the ADMIN user
  // who owns the business they work for. For a business owner themselves,
  // their own id is implicitly their business owner id — no row needed.
  // Null for super admin and unassigned accounts.
  @Column({ type: 'uuid', nullable: true })
  businessOwnerId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings: Booking[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];
}