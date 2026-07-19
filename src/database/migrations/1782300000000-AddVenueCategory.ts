import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVenueCategory1782300000000 implements MigrationInterface {
  name = 'AddVenueCategory1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "venues"
      ADD COLUMN IF NOT EXISTS "category" varchar(20) NOT NULL DEFAULT 'club'
    `);

    await queryRunner.query(`
      ALTER TABLE "venues"
      ADD CONSTRAINT "chk_venues_category"
      CHECK ("category" IN ('club', 'restaurant', 'lounge'))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_venues_category" ON "venues" ("category")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_venues_category"`);
    await queryRunner.query(`ALTER TABLE "venues" DROP CONSTRAINT IF EXISTS "chk_venues_category"`);
    await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN IF EXISTS "category"`);
  }
}
