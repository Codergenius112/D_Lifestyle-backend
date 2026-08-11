import { MigrationInterface, QueryRunner } from 'typeorm';

export class ManualOrderAndAuditImprovements1782800000000 implements MigrationInterface {
  name = 'ManualOrderAndAuditImprovements1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

    // Audit logs record actorId as a raw UUID with no human-readable name,
    // making the audit trail hard to read. Denormalize the actor's display
    // name onto the log row at write time (so it survives even if the user
    // is later renamed or deleted).
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS "actorName" VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS "actorName"`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS "eventId"`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS "venueId"`);
    await queryRunner.query(`ALTER TABLE orders ALTER COLUMN "bookingId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE inventory_items DROP COLUMN IF EXISTS "sellingPrice"`);
  }
}
