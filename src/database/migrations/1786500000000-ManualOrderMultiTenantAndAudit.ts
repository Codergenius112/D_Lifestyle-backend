import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consolidates three migrations that were originally written separately
 * (ManualOrderAndAuditImprovements, BusinessOwnerScoping, AddEventOwnerId)
 * but never successfully applied — they all failed together in the same
 * batch transaction (a type mismatch in the events backfill rolled all
 * three back). Since none of them ever actually ran, merging into one
 * clean migration carries zero production risk and removes clutter.
 */
export class ManualOrderMultiTenantAndAudit1786500000000 implements MigrationInterface {
  name = 'ManualOrderMultiTenantAndAudit1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Manual purchases: optional table, inventory pricing, audit names ──

    // Inventory items need a selling price so manual purchases can pull
    // price directly from stock instead of staff typing it in freehand.
    await queryRunner.query(`
      ALTER TABLE inventory_items
      ADD COLUMN IF NOT EXISTS "sellingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0
    `);

    // Orders currently require a bookingId. Manual purchases at an event or
    // venue without a table/booking (e.g. a walk-up drink purchase) need to
    // record against the venue or event directly instead.
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN "bookingId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS "venueId" UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS "eventId" UUID NULL
    `);

    // Audit logs record actorId as a raw UUID with no human-readable name.
    // Denormalize the actor's display name onto the log row at write time.
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS "actorName" VARCHAR(255) NULL
    `);

    // ── Multi-tenant business owner model ──

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

    // Events can now exist independent of a venue (one-off events), so
    // ownership can't rely on venue.ownerId alone — needs a direct field.
    await queryRunner.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS "ownerId" UUID NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_events_owner_id ON events ("ownerId")
    `);
    // Backfill existing events from their venue's owner where possible.
    // events.venueId is a plain varchar (not a real FK), while venues.id
    // is uuid — cast the uuid side to text rather than the varchar side to
    // uuid, since some venueId values may not be valid UUIDs at all (per
    // the original "plain string key" design) and a uuid cast would throw.
    await queryRunner.query(`
      UPDATE events e
      SET "ownerId" = v."ownerId"
      FROM venues v
      WHERE e."venueId" = v.id::text AND e."ownerId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_events_owner_id`);
    await queryRunner.query(`ALTER TABLE events DROP COLUMN IF EXISTS "ownerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inventory_items_owner_id`);
    await queryRunner.query(`ALTER TABLE inventory_items DROP COLUMN IF EXISTS "ownerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_business_owner_id`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "businessOwnerId"`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS "actorName"`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS "eventId"`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS "venueId"`);
    await queryRunner.query(`ALTER TABLE orders ALTER COLUMN "bookingId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE inventory_items DROP COLUMN IF EXISTS "sellingPrice"`);
  }
}
