import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0 of the multi-tenancy rollout (see Zentra Multi-Tenancy PRD,
 * section 12). This migration only ADDS schema — it creates the new
 * tenant tables and adds nullable businessId columns to existing tables.
 * Nothing is backfilled and nothing is enforced yet (both happen in
 * Phase 1 / Phase 2), so this is safe to run against the current
 * single-business production data with zero behavioural change.
 */
export class CreateMultiTenancyPhase01787000000000 implements MigrationInterface {
  name = 'CreateMultiTenancyPhase01787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── businesses (tenant root) ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "businesses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "businessScopes" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "payoutDetails" jsonb NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON "businesses" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_businesses_status ON "businesses" ("status")`);

    // ── staff_business_assignments ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff_business_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "businessId" uuid NOT NULL,
        "role" varchar(30) NOT NULL,
        "scopes" text NULL,
        "assignedBy" uuid NOT NULL,
        "assignedAt" timestamp NOT NULL DEFAULT now(),
        "revokedAt" timestamp NULL,
        "revokedBy" uuid NULL,
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sba_user_id ON "staff_business_assignments" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sba_business_id ON "staff_business_assignments" ("businessId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sba_user_business_active ON "staff_business_assignments" ("userId", "businessId", "revokedAt")`);

    // ── business_data_shares ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_data_shares" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "fromBusinessId" uuid NOT NULL,
        "toBusinessId" uuid NOT NULL,
        "dataTypes" text NOT NULL,
        "grantedBy" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "revokedAt" timestamp NULL,
        "revokedBy" uuid NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bds_from_business ON "business_data_shares" ("fromBusinessId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bds_to_business ON "business_data_shares" ("toBusinessId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bds_active ON "business_data_shares" ("fromBusinessId", "toBusinessId", "revokedAt")`);

    // ── nullable businessId on listings ──
    await queryRunner.query(`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_venues_business_id ON "venues" ("businessId")`);

    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_business_id ON "events" ("businessId")`);

    await queryRunner.query(`ALTER TABLE "car_listings" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_car_listings_business_id ON "car_listings" ("businessId")`);

    await queryRunner.query(`ALTER TABLE "apartment_listings" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_apartment_listings_business_id ON "apartment_listings" ("businessId")`);

    // ── denormalized businessId on hot transactional tables ──
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON "bookings" ("businessId")`);

    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_business_id ON "orders" ("businessId")`);

    await queryRunner.query(`ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "businessId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_business_id ON "payment_transactions" ("businessId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_business_id`);
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "businessId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_business_id`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "businessId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookings_business_id`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "businessId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_apartment_listings_business_id`);
    await queryRunner.query(`ALTER TABLE "apartment_listings" DROP COLUMN IF EXISTS "businessId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_car_listings_business_id`);
    await queryRunner.query(`ALTER TABLE "car_listings" DROP COLUMN IF EXISTS "businessId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_events_business_id`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "businessId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_venues_business_id`);
    await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN IF EXISTS "businessId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_bds_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bds_to_business`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bds_from_business`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_data_shares"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_sba_user_business_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sba_business_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sba_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_business_assignments"`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_businesses_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_businesses_owner_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS "businesses"`);
  }
}
