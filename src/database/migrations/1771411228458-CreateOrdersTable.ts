import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateOrdersTable1771411228458 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'bookingId',
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'CREATED',
              'ASSIGNED',
              'ROUTED',
              'IN_PREPARATION',
              'READY',
              'SERVED',
              'COMPLETED',
              'CANCELLED',
            ],
            default: "'CREATED'",
          },
          {
            name: 'items',
            type: 'jsonb',
          },
          {
            name: 'totalAmount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'assignedToUserId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'routedToStationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'readyAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'servedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_booking_id',
        columnNames: ['bookingId'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_user_id',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_assigned_to',
        columnNames: ['assignedToUserId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders');
  }
}