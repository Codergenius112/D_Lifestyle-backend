import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex} from 'typeorm';

export class CreateBookingsTable implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'bookings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'bookingType',
            type: 'enum',
            enum: ['ticket', 'table', 'apartment', 'car'],
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'groupId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resourceId',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'INITIATED',
              'PENDING_PAYMENT',
              'PENDING_GROUP_PAYMENT',
              'CONFIRMED',
              'CHECKED_IN',
              'ACTIVE',
              'COMPLETED',
              'CANCELLED',
              'EXPIRED',
            ],
            default: "'INITIATED'",
          },
          {
            name: 'guestCount',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'basePrice',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'platformCommission',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'serviceCharge',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalAmount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'paymentStatus',
            type: 'enum',
            enum: ['UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'REFUNDED'],
            default: "'UNPAID'",
          },
          {
            name: 'paymentMethod',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'checkInTime',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelledAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
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

    await queryRunner.createForeignKey(
      'bookings',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'bookings',
      new TableIndex({
        name: 'idx_bookings_user_id',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'bookings',
      new TableIndex({
        name: 'idx_bookings_type',
        columnNames: ['bookingType'],
      }),
    );

    await queryRunner.createIndex(
      'bookings',
      new TableIndex({
        name: 'idx_bookings_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'bookings',
      new TableIndex({
        name: 'idx_bookings_group_id',
        columnNames: ['groupId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bookings');
  }
}