import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFinancialLedgerTable1771411035850 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'financial_ledger',
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
            isNullable: true,
          },
          {
            name: 'transactionType',
            type: 'enum',
            enum: ['DEBIT', 'CREDIT'],
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'NGN'",
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'relatedUserId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'financial_ledger',
      new TableIndex({
        name: 'idx_ledger_booking_id',
        columnNames: ['bookingId'],
      }),
    );

    await queryRunner.createIndex(
      'financial_ledger',
      new TableIndex({
        name: 'idx_ledger_timestamp',
        columnNames: ['timestamp'],
      }),
    );

    // Prevent deletion of ledger entries
    await queryRunner.query(`
      CREATE TRIGGER prevent_ledger_deletion
      BEFORE DELETE ON financial_ledger
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_deletion();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('financial_ledger');
  }
}
