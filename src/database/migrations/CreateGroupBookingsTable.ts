import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateGroupBookingsTable implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'group_bookings',
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
            name: 'initiatorId',
            type: 'uuid',
          },
          {
            name: 'participantIds',
            type: 'text',
            isArray: true,
          },
          {
            name: 'contributionTracker',
            type: 'jsonb',
          },
          {
            name: 'totalRequired',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'totalPaid',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'countdownExpiresAt',
            type: 'timestamp',
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
      'group_bookings',
      new TableIndex({
        name: 'idx_group_booking_id',
        columnNames: ['bookingId'],
      }),
    );

    await queryRunner.createIndex(
      'group_bookings',
      new TableIndex({
        name: 'idx_group_initiator_id',
        columnNames: ['initiatorId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('group_bookings');
  }
}