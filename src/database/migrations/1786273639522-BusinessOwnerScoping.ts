import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces per-business-owner scoping. Venue.ownerId, ApartmentListing.
 * managedBy, and CarListing.managedBy already exist and identify which
 * business owner (an ADMIN-role user) a resource belongs to — they were
 * just never used for access control until now.
 *
 * What's new here:
 * - User.businessOwnerId: for staff (Manager/Waiter/Bar/Kitchen/Door), this
 *   points at the ADMIN user who owns the business they work for. For an
 *   owner themselves, their own id IS their business owner id (no row
 *   needed). Null for super admin and unassigned accounts.
 * - InventoryItem.ownerId: inventory can belong to an apartment/car
 *   business with no venue at all, so it needs its own direct owner
 *   reference rather than relying on a venue join.
 */
export class BusinessOwnerScoping1786273639522 implements MigrationInterface {
  name = 'BusinessOwnerScoping1786273639522';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "businessOwnerId" UUID NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_business_owner_id ON users ("businessOwnerId")
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_items
      ADD COLUMN IF NOT EXISTS "ownerId" UUID NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_items_owner_id ON inventory_items ("ownerId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inventory_items_owner_id`);
    await queryRunner.query(`ALTER TABLE inventory_items DROP COLUMN IF EXISTS "ownerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_business_owner_id`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "businessOwnerId"`);
  }
}
