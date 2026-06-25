import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderLocationFields1782100000000 implements MigrationInterface {
  name = 'AddOrderLocationFields1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add table info and pickup location columns to orders table
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "tableInfo" jsonb,
      ADD COLUMN IF NOT EXISTS "pickupLocation" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "pickupLocation",
      DROP COLUMN IF EXISTS "tableInfo"
    `);
  }
}
