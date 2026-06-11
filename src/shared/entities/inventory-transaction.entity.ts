import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

export enum TransactionType {
  RESTOCK = 'RESTOCK',
  DEDUCTION = 'DEDUCTION',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  itemId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'integer' })
  balanceBefore: number;

  @Column({ type: 'integer' })
  balanceAfter: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid' })
  performedBy: string;

  @Column({ type: 'varchar', length: 50 })
  performedByRole: string;

  @CreateDateColumn()
  createdAt: Date;
}