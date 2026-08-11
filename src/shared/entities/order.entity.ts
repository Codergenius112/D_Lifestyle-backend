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

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne(() => Booking)
  booking: Booking;

  // Alternative targets for manual purchases with no table/booking — e.g. a
  // walk-up drink bought at an event without a ticket, or at a venue bar
  // without sitting at a table. Exactly one of bookingId/venueId/eventId
  // should be set.
  @Column({ type: 'uuid', nullable: true })
  venueId: string | null;

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

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

  // Table order info (for table bookings)
  @Column({ type: 'jsonb', nullable: true })
  tableInfo: {
    tableId: string;
    tableName: string;
    category: string;
    venueId: string;
  };

  // Pickup location (for ticket/event orders)
  @Column({ type: 'varchar', length: 100, nullable: true })
  pickupLocation: string; // e.g. "Bar Counter", "Kitchen Window", "Food Station 1"

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
