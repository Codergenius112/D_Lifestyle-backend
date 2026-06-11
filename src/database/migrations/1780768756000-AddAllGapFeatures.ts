import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllGapFeatures1800000000000 implements MigrationInterface {
  name = 'AddAllGapFeatures1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. BusinessScope enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE business_scope_enum AS ENUM (
          'CAR_RENTAL','APARTMENT','TABLE_CLUB','EVENT_TICKETING'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 2. Users: businessScopes, isDeleted
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "businessScopes" TEXT,
        ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // 3. Bookings: QR + caution fee fields + isDeleted
    await queryRunner.query(`
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS "qrCodeData" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "scannedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "scannedBy" UUID,
        ADD COLUMN IF NOT EXISTS "cautionFeeStatus" VARCHAR(20) NOT NULL DEFAULT 'HELD',
        ADD COLUMN IF NOT EXISTS "cautionFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cautionFeeResolvedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "cautionFeeResolvedBy" UUID,
        ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // 4. ApartmentListings: caution fee + houseRules + unavailableDates + isDeleted
    await queryRunner.query(`
      ALTER TABLE apartment_listings
        ADD COLUMN IF NOT EXISTS "cautionFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cautionFeeRefundable" BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS "houseRules" TEXT,
        ADD COLUMN IF NOT EXISTS "unavailableDates" TEXT,
        ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // 5. CarListings: caution fee + unavailableDates + assignedDriverId + isDeleted
    await queryRunner.query(`
      ALTER TABLE car_listings
        ADD COLUMN IF NOT EXISTS "cautionFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cautionFeeRefundable" BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS "unavailableDates" TEXT,
        ADD COLUMN IF NOT EXISTS "assignedDriverId" UUID,
        ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // 6. Venues
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS venues (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"        VARCHAR(200) NOT NULL,
        "address"     VARCHAR(255) NOT NULL,
        "city"        VARCHAR(100) NOT NULL,
        "maxCapacity" INTEGER NOT NULL DEFAULT 0,
        "ownerId"     UUID,
        "mediaUrls"   JSONB NOT NULL DEFAULT '[]',
        "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
        "isDeleted"   BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 7. TicketTypes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ticket_types (
        "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId"   UUID NOT NULL,
        "name"      VARCHAR(100) NOT NULL,
        "price"     DECIMAL(12,2) NOT NULL,
        "capacity"  INTEGER NOT NULL,
        "sold"      INTEGER NOT NULL DEFAULT 0,
        "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 8. Stations
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE station_type_enum AS ENUM ('KITCHEN','BAR','OTHER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stations (
        "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "venueId"   UUID NOT NULL,
        "name"      VARCHAR(100) NOT NULL,
        "type"      station_type_enum NOT NULL,
        "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
        "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 9. NotificationCampaigns
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_campaigns (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdBy"      UUID NOT NULL,
        "title"          VARCHAR(200) NOT NULL,
        "body"           TEXT NOT NULL,
        "targetScope"    VARCHAR(50) NOT NULL,
        "status"         VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        "sentAt"         TIMESTAMP,
        "recipientCount" INTEGER NOT NULL DEFAULT 0,
        "feePaid"        DECIMAL(12,2) NOT NULL DEFAULT 0,
        "paymentStatus"  VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 10. PlatformSettings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "serviceCharge"       DECIMAL(12,2) NOT NULL DEFAULT 400,
        "commissionRate"      DECIMAL(5,4)  NOT NULL DEFAULT 0.03,
        "pushNotificationFee" DECIMAL(12,2) NOT NULL DEFAULT 5000,
        "updatedBy"           UUID,
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 11. InventoryItems
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE inventory_category_enum AS ENUM (
          'BAR_STOCK','KITCHEN_INGREDIENT','VEHICLE_SUPPLY',
          'APARTMENT_SUPPLY','VENUE_EQUIPMENT'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"              VARCHAR(200) NOT NULL,
        "sku"               VARCHAR(100) NOT NULL,
        "category"          inventory_category_enum NOT NULL,
        "unit"              VARCHAR(50) NOT NULL,
        "currentStock"      INTEGER NOT NULL DEFAULT 0,
        "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
        "venueId"           UUID,
        "businessScope"     TEXT NOT NULL,
        "isDeleted"         BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 12. InventoryTransactions
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_type_enum AS ENUM ('RESTOCK','DEDUCTION','ADJUSTMENT');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId"          UUID NOT NULL,
        "type"            transaction_type_enum NOT NULL,
        "quantity"        INTEGER NOT NULL,
        "balanceBefore"   INTEGER NOT NULL,
        "balanceAfter"    INTEGER NOT NULL,
        "reason"          TEXT,
        "performedBy"     UUID NOT NULL,
        "performedByRole" TEXT NOT NULL,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS platform_settings`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_campaigns`);
    await queryRunner.query(`DROP TABLE IF EXISTS stations`);
    await queryRunner.query(`DROP TABLE IF EXISTS ticket_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS venues`);
  }
}