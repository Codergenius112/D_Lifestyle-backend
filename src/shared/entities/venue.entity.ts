import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 20, default: 'club' })
  category: 'club' | 'restaurant' | 'lounge';

  @Column({ type: 'integer', default: 0 })
  maxCapacity: number;

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  mediaUrls: string[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  // Floor plan fields
  @Column({ type: 'boolean', default: false })
  hasFloorPlan: boolean;

  @Column({ type: 'jsonb', nullable: true })
  floorPlanData: {
    width: number;
    height: number;
    backgroundImage?: string;
    tables: Array<{
      tableId: string;
      x: number;
      y: number;
      rotation: number;
      width: number;
      height: number;
    }>;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}