import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { OrderStatus } from '../enums';
import { User } from './user.entity';
import { Booking } from './booking.entity';

@Entity('orders')
@Index('idx_orders_booking_id', ['bookingId'])
@Index('idx_orders_user_id', ['userId'])
@Index('idx_orders_status', ['status'])
@Index('idx_orders_assigned_to', ['assignedToUserId'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking)
  booking: Booking;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.orders)
  user: User;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.CREATED })
  status: OrderStatus;

  @Column({ type: 'jsonb' })
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'uuid', nullable: true })
  assignedToUserId: string; // Waiter/Server assigned

  @Column({ type: 'uuid', nullable: true })
  routedToStationId: string; // Kitchen/Bar station

  @Column({ type: 'timestamp', nullable: true })
  readyAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  servedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
