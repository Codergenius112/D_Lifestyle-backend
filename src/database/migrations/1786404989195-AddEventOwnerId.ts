import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Events previously had no direct owner field, relying implicitly on their
 * venue's ownerId. Since events can now be created independent of a venue
 * (one-off events), that chain breaks for venue-less events. This adds a
 * direct owner reference so every event has an unambiguous owner
 * regardless of whether it has a venue.
 */
export class AddEventOwnerId1786404989195 implements MigrationInterface {
  name = 'AddEventOwnerId1786404989195';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }
}