import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 of the multi-tenancy rollout (see Zentra Multi-Tenancy PRD,
 * section 12). This is a DATA migration that runs after Phase 0's schema
 * additions. It:
 *
 *   1. Creates one default Business per existing owner (User with
 *      role='admin' and businessOwnerId IS NULL), carrying over their
 *      existing businessScopes so nothing they could do before is lost.
 *   2. Backfills businessId on venues, events, car_listings and
 *      apartment_listings from their existing owner references —
 *      confirmed against OwnershipResolverService's join logic:
 *        venues.ownerId, events.ownerId  → direct
 *        car_listings.managedBy, apartment_listings.managedBy → de facto
 *        owner id (this is how OwnershipResolverService already treats them)
 *   3. Backfills the denormalized businessId on bookings (resolving the
 *      polymorphic resourceId per bookingType), then orders (via
 *      bookingId/venueId/eventId), then payment_transactions (via
 *      bookingId).
 *   4. Backfills StaffBusinessAssignment from each staff member's existing
 *      businessOwnerId + businessScopes, pointed at that owner's new
 *      default Business.
 *
 * businessOwnerId / businessScopes on User are NOT dropped here — they
 * stay in place until Phase 6 (deprecation) once Phase 2 enforcement has
 * been stable in production for an agreed window.
 *
 * NOTE ON down(): this migration's rollback is intentionally simple —
 * it deletes every Business/StaffBusinessAssignment row this migration
 * could have created and nulls every businessId column back out. It is
 * meant for rolling back a Phase 1 run in staging/pre-production, not for
 * safely undoing weeks of live multi-tenant activity — anything created
 * after this migration ran under a real business context would also be
 * wiped. Do not run down() in production once Phase 2+ is live.
 */
export class BackfillMultiTenancyPhase11787100000000 implements MigrationInterface {
  name = 'BackfillMultiTenancyPhase11787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. One default Business per existing owner ──
    await queryRunner.query(`
      INSERT INTO "businesses"
        (id, "ownerId", name, "businessScopes", status, "isActive", "isDeleted", "createdAt", "updatedAt")
      SELECT
        gen_random_uuid(),
        u.id,
        COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), u.email) || '''s Business',
        COALESCE(NULLIF(u."businessScopes", ''), 'CAR_RENTAL,APARTMENT,TABLE_CLUB,EVENT_TICKETING'),
        'APPROVED',
        true,
        false,
        now(),
        now()
      FROM "users" u
      WHERE u.role = 'admin'
        AND u."businessOwnerId" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "businesses" b WHERE b."ownerId" = u.id)
    `);

    // ── 2. Backfill businessId on listings from their existing owner refs ──
    await queryRunner.query(`
      UPDATE "venues" v
      SET "businessId" = b.id
      FROM "businesses" b
      WHERE v."ownerId" = b."ownerId" AND v."businessId" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "events" e
      SET "businessId" = b.id
      FROM "businesses" b
      WHERE e."ownerId" = b."ownerId" AND e."businessId" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "car_listings" c
      SET "businessId" = b.id
      FROM "businesses" b
      WHERE c."managedBy" = b."ownerId" AND c."businessId" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "apartment_listings" a
      SET "businessId" = b.id
      FROM "businesses" b
      WHERE a."managedBy" = b."ownerId" AND a."businessId" IS NULL
    `);

    // ── 3a. Backfill bookings.businessId (polymorphic resourceId per bookingType) ──
    // TABLE: resourceId → table_listings.id → venue.businessId OR event.businessId
    await queryRunner.query(`
      UPDATE "bookings" bk
      SET "businessId" = COALESCE(v."businessId", ev."businessId")
      FROM "table_listings" tl
      LEFT JOIN "venues" v ON v.id = tl."venueId"
      LEFT JOIN "events" ev ON ev.id = tl."eventId"
      WHERE bk."bookingType" = 'table'
        AND bk."resourceId" = tl.id
        AND bk."businessId" IS NULL
    `);

    // APARTMENT: resourceId → apartment_listings.id
    await queryRunner.query(`
      UPDATE "bookings" bk
      SET "businessId" = al."businessId"
      FROM "apartment_listings" al
      WHERE bk."bookingType" = 'apartment'
        AND bk."resourceId" = al.id
        AND bk."businessId" IS NULL
    `);

    // CAR: resourceId → car_listings.id
    await queryRunner.query(`
      UPDATE "bookings" bk
      SET "businessId" = cl."businessId"
      FROM "car_listings" cl
      WHERE bk."bookingType" = 'car'
        AND bk."resourceId" = cl.id
        AND bk."businessId" IS NULL
    `);

    // TICKET: resourceId = eventId directly (confirmed in admin-bookings.controller.ts)
    await queryRunner.query(`
      UPDATE "bookings" bk
      SET "businessId" = ev."businessId"
      FROM "events" ev
      WHERE bk."bookingType" = 'ticket'
        AND bk."resourceId" = ev.id
        AND bk."businessId" IS NULL
    `);

    // ── 3b. Backfill orders.businessId via bookingId, else venueId, else eventId ──
    await queryRunner.query(`
      UPDATE "orders" o
      SET "businessId" = bk."businessId"
      FROM "bookings" bk
      WHERE o."bookingId" = bk.id AND o."businessId" IS NULL AND bk."businessId" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "orders" o
      SET "businessId" = v."businessId"
      FROM "venues" v
      WHERE o."venueId" = v.id AND o."businessId" IS NULL AND v."businessId" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "orders" o
      SET "businessId" = ev."businessId"
      FROM "events" ev
      WHERE o."eventId" = ev.id AND o."businessId" IS NULL AND ev."businessId" IS NOT NULL
    `);

    // ── 3c. Backfill payment_transactions.businessId via bookingId ──
    await queryRunner.query(`
      UPDATE "payment_transactions" pt
      SET "businessId" = bk."businessId"
      FROM "bookings" bk
      WHERE pt."bookingId" = bk.id AND pt."businessId" IS NULL AND bk."businessId" IS NOT NULL
    `);

    // ── 4. Backfill StaffBusinessAssignment from existing businessOwnerId/businessScopes ──
    await queryRunner.query(`
      INSERT INTO "staff_business_assignments"
        (id, "userId", "businessId", role, scopes, "assignedBy", "assignedAt", "updatedAt")
      SELECT
        gen_random_uuid(),
        u.id,
        b.id,
        u.role,
        NULLIF(u."businessScopes", ''),
        u."businessOwnerId",
        u."createdAt",
        now()
      FROM "users" u
      JOIN "businesses" b ON b."ownerId" = u."businessOwnerId"
      WHERE u."businessOwnerId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "staff_business_assignments" sba
          WHERE sba."userId" = u.id AND sba."businessId" = b.id AND sba."revokedAt" IS NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "staff_business_assignments"`);

    await queryRunner.query(`UPDATE "payment_transactions" SET "businessId" = NULL`);
    await queryRunner.query(`UPDATE "orders" SET "businessId" = NULL`);
    await queryRunner.query(`UPDATE "bookings" SET "businessId" = NULL`);
    await queryRunner.query(`UPDATE "apartment_listings" SET "businessId" = NULL`);
    await queryRunner.query(`UPDATE "car_listings" SET "businessId" = NULL`);
    await queryRunner.query(`UPDATE "events" SET "businessId" = NULL`);
    await queryRunner.query(`UPDATE "venues" SET "businessId" = NULL`);

    await queryRunner.query(`DELETE FROM "businesses"`);
  }
}
