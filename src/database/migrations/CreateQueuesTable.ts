import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateQueuesTable implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'queues',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'venueId',
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'position',
            type: 'integer',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'WAITING'",
          },
          {
            name: 'calledAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'checkedInAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelledAt',
            type: 'timestamp',
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
      'queues',
      new TableIndex({
        name: 'idx_queue_venue_id',
        columnNames: ['venueId'],
      }),
    );

    await queryRunner.createIndex(
      'queues',
      new TableIndex({
        name: 'idx_queue_user_id',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'queues',
      new TableIndex({
        name: 'idx_queue_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('queues');
  }
}
