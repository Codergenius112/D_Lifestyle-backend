import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { BusinessScope } from '../../shared/enums';

export enum InventoryCategory {
  BAR_STOCK = 'BAR_STOCK',
  KITCHEN_INGREDIENT = 'KITCHEN_INGREDIENT',
  VEHICLE_SUPPLY = 'VEHICLE_SUPPLY',
  APARTMENT_SUPPLY = 'APARTMENT_SUPPLY',
  VENUE_EQUIPMENT = 'VENUE_EQUIPMENT',
}

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'enum', enum: InventoryCategory })
  category: InventoryCategory;

  @Column({ type: 'varchar', length: 50 })
  unit: string;

  @Column({ type: 'integer', default: 0 })
  currentStock: number;

  @Column({ type: 'integer', default: 0 })
  lowStockThreshold: number;

  @Column({ type: 'uuid', nullable: true })
  venueId: string | null;

  @Column({ type: 'enum', enum: BusinessScope })
  businessScope: BusinessScope;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}