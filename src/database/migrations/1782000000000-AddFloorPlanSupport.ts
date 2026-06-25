import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFloorPlanSupport1782000000000 implements MigrationInterface {
  name = 'AddFloorPlanSupport1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add floor plan columns to venues table
    await queryRunner.query(`
      ALTER TABLE "venues"
      ADD COLUMN IF NOT EXISTS "hasFloorPlan" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "floorPlanData" jsonb
    `);

    // Add floor plan position column to table_listings
    await queryRunner.query(`
      ALTER TABLE "table_listings"
      ADD COLUMN IF NOT EXISTS "floorPlanPosition" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "venues"
      DROP COLUMN IF EXISTS "floorPlanData",
      DROP COLUMN IF EXISTS "hasFloorPlan"
    `);

    await queryRunner.query(`
      ALTER TABLE "table_listings"
      DROP COLUMN IF EXISTS "floorPlanPosition"
    `);
  }
}
