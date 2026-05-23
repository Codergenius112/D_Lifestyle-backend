import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum MenuCategory {
  FOOD      = 'food',
  DRINKS    = 'drinks',
  COCKTAILS = 'cocktails',
  BOTTLES   = 'bottles',
  DESSERTS  = 'desserts',
  EXTRAS    = 'extras',
}

@Entity('menu_items')
@Index('idx_menu_items_venue', ['venueId'])
@Index('idx_menu_items_category', ['category'])
@Index('idx_menu_items_active', ['isAvailable'])
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  venueId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: MenuCategory })
  category: MenuCategory;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl: string;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}