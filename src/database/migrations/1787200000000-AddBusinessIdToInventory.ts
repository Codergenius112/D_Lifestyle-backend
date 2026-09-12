import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Small follow-on to the Phase 0/1 multi-tenancy migrations
 * (1787000000000-CreateMultiTenancyPhase0 and
 * 1787100000000-BackfillMultiTenancyPhase1). InventoryItem was not covered
 * by those two because it wasn't in scope for the original bookings/orders/
 * analytics pass — this brings inventory into the same model: add a
 * nullable businessId column, then backfill it from the existing ownerId
 * (InventoryItem already carries a direct owner reference, so this is a
 * simple join, no polymorphic resourceId resolution needed).
 */
export class AddBusinessIdToInventory1787200000000 implements MigrationInterface {
  name = 'AddBusinessIdToInventory1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inventory_items_business_id ON "inventory_items" ("businessId")`);

    await queryRunner.query(`
      UPDATE "inventory_items" i
      SET "businessId" = b.id
      FROM "businesses" b
      WHERE i."ownerId" = b."ownerId" AND i."businessId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inventory_items_business_id`);
    await queryRunner.query(`ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "businessId"`);
  }
}
