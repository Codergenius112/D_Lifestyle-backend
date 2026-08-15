import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryItemUpdatedToAuditActionEnum1786600000001 implements MigrationInterface {
  name = 'AddInventoryItemUpdatedToAuditActionEnum1786600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "audit_logs_actiontype_enum"
      ADD VALUE IF NOT EXISTS 'INVENTORY_ITEM_UPDATED'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing a value from an enum type directly.
    // A rollback would require recreating the enum type and column, which
    // is destructive — intentionally left as a no-op.
  }
}