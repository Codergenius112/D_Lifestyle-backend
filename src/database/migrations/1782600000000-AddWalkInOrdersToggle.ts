import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalkInOrdersToggle1782600000000 implements MigrationInterface {
  name = 'AddWalkInOrdersToggle1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "venues"
      ADD COLUMN IF NOT EXISTS "allowWalkInOrders" boolean DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "venues"
      DROP COLUMN IF EXISTS "allowWalkInOrders"
    `);
  }
}
