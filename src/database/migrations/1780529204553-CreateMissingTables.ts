import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMissingTables1780529204553 implements MigrationInterface {
    name = 'CreateMissingTables1780529204553'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "apartment_listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "description" text NOT NULL, "address" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "state" character varying(100) NOT NULL, "pricePerNight" numeric(12,2) NOT NULL, "bedrooms" integer NOT NULL, "bathrooms" integer NOT NULL, "maxGuests" integer NOT NULL, "amenities" jsonb NOT NULL DEFAULT '[]', "images" jsonb NOT NULL DEFAULT '[]', "isActive" boolean NOT NULL DEFAULT true, "managedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4bfb648f460665ea6e65b9bdeb1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_apartment_listings_city" ON "apartment_listings" ("city") `);
        await queryRunner.query(`CREATE INDEX "idx_apartment_listings_active" ON "apartment_listings" ("isActive") `);
        await queryRunner.query(`CREATE TABLE "car_listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "make" character varying(100) NOT NULL, "model" character varying(100) NOT NULL, "year" integer NOT NULL, "color" character varying(50) NOT NULL, "plateNumber" character varying(20) NOT NULL, "transmission" character varying(20) NOT NULL, "category" character varying(50) NOT NULL, "seats" integer NOT NULL, "pricePerDay" numeric(12,2) NOT NULL, "description" text NOT NULL, "features" jsonb NOT NULL DEFAULT '[]', "images" jsonb NOT NULL DEFAULT '[]', "city" character varying(100) NOT NULL, "state" character varying(100) NOT NULL, "withDriver" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "managedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9b5a60cd833afe6526b8e261616" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_car_listings_city" ON "car_listings" ("city") `);
        await queryRunner.query(`CREATE INDEX "idx_car_listings_active" ON "car_listings" ("isActive") `);
        await queryRunner.query(`CREATE TYPE "public"."table_listings_category_enum" AS ENUM('standard', 'vip', 'vvip', 'booth', 'private')`);
        await queryRunner.query(`CREATE TABLE "table_listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "venueId" uuid NOT NULL, "name" character varying(100) NOT NULL, "category" "public"."table_listings_category_enum" NOT NULL DEFAULT 'standard', "capacity" integer NOT NULL, "price" numeric(12,2) NOT NULL, "description" text, "features" jsonb, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_777af33dfe04779dc61dada06d7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_table_listings_is_active" ON "table_listings" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "idx_table_listings_category" ON "table_listings" ("category") `);
        await queryRunner.query(`CREATE INDEX "idx_table_listings_venue_id" ON "table_listings" ("venueId") `);
        await queryRunner.query(`CREATE TYPE "public"."menu_items_category_enum" AS ENUM('food', 'drinks', 'cocktails', 'bottles', 'desserts', 'extras')`);
        await queryRunner.query(`CREATE TABLE "menu_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "venueId" character varying(100) NOT NULL, "name" character varying(150) NOT NULL, "description" text, "category" "public"."menu_items_category_enum" NOT NULL, "price" numeric(12,2) NOT NULL, "imageUrl" character varying(255), "isAvailable" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_menu_items_active" ON "menu_items" ("isAvailable") `);
        await queryRunner.query(`CREATE INDEX "idx_menu_items_category" ON "menu_items" ("category") `);
        await queryRunner.query(`CREATE INDEX "idx_menu_items_venue" ON "menu_items" ("venueId") `);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "description" text NOT NULL, "venueId" character varying(100) NOT NULL, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "capacity" integer NOT NULL DEFAULT '0', "djs" jsonb NOT NULL DEFAULT '[]', "genre" character varying(100), "dresscode" character varying(100), "status" character varying(50) NOT NULL DEFAULT 'active', "ticketPrice" numeric(12,2) NOT NULL DEFAULT '0', "images" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_events_start_date" ON "events" ("startDate") `);
        await queryRunner.query(`CREATE INDEX "idx_events_status" ON "events" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_events_venue_id" ON "events" ("venueId") `);
        await queryRunner.query(`CREATE TABLE "device_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "token" text NOT NULL, "platform" character varying(20) NOT NULL DEFAULT 'expo', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_977e24c520c49436d08e5eeea8a" UNIQUE ("token"), CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_device_tokens_token" ON "device_tokens" ("token") `);
        await queryRunner.query(`CREATE INDEX "idx_device_tokens_user_id" ON "device_tokens" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_device_tokens_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_device_tokens_token"`);
        await queryRunner.query(`DROP TABLE "device_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."idx_events_venue_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_events_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_events_start_date"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP INDEX "public"."idx_menu_items_venue"`);
        await queryRunner.query(`DROP INDEX "public"."idx_menu_items_category"`);
        await queryRunner.query(`DROP INDEX "public"."idx_menu_items_active"`);
        await queryRunner.query(`DROP TABLE "menu_items"`);
        await queryRunner.query(`DROP TYPE "public"."menu_items_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_table_listings_venue_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_table_listings_category"`);
        await queryRunner.query(`DROP INDEX "public"."idx_table_listings_is_active"`);
        await queryRunner.query(`DROP TABLE "table_listings"`);
        await queryRunner.query(`DROP TYPE "public"."table_listings_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_car_listings_active"`);
        await queryRunner.query(`DROP INDEX "public"."idx_car_listings_city"`);
        await queryRunner.query(`DROP TABLE "car_listings"`);
        await queryRunner.query(`DROP INDEX "public"."idx_apartment_listings_active"`);
        await queryRunner.query(`DROP INDEX "public"."idx_apartment_listings_city"`);
        await queryRunner.query(`DROP TABLE "apartment_listings"`);
    }

}
