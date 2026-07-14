import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allows a table_listing to belong to EITHER a permanent venue OR a one-off
 * event, not only a venue.
 *
 * Rationale: recurring venues (clubs, lounges) have a manager and reuse the
 * same physical tables across many events, so those stay venue-scoped and
 * still get double-booking protection shared across every event held there.
 * One-off spaces (stadiums, open fields, arenas) rented for a single rave or
 * concert have no ongoing manager and no reason to pre-register as a venue —
 * their tables belong directly to the event instead.
 *
 * Exactly one of venueId / eventId must be set — never both, never neither.
 */
export class AllowEventScopedTables1782200000000 implements MigrationInterface {
  name = 'AllowEventScopedTables1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "table_listings"
      ALTER COLUMN "venueId" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "table_listings"
      ADD COLUMN IF NOT EXISTS "eventId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_table_listings_event_id"
      ON "table_listings" ("eventId")
    `);

    // Enforce exactly one of venueId / eventId is set
    await queryRunner.query(`
      ALTER TABLE "table_listings"
      ADD CONSTRAINT "chk_table_listings_venue_xor_event"
      CHECK (
        ("venueId" IS NOT NULL AND "eventId" IS NULL) OR
        ("venueId" IS NULL AND "eventId" IS NOT NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "table_listings"
      DROP CONSTRAINT IF EXISTS "chk_table_listings_venue_xor_event"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_table_listings_event_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "table_listings"
      DROP COLUMN IF EXISTS "eventId"
    `);

    // NOTE: does not restore NOT NULL on venueId — any event-scoped rows
    // created while this migration was applied would violate it and
    // block the rollback. Clean those up manually before downgrading
    // if you ever need to.
  }
}
