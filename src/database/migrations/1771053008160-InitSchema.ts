import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1771053008160 implements MigrationInterface {
    name = 'InitSchema1771053008160'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "balance" numeric(12,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'NGN', "lastTransactionAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_2ecdb33f23e9a6fc392025c0b9" UNIQUE ("userId"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_wallets_user_id" ON "wallets" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."payment_transactions_status_enum" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payment_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "userId" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "status" "public"."payment_transactions_status_enum" NOT NULL, "paymentMethod" character varying(50), "externalRefId" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP, CONSTRAINT "PK_d32b3c6b0d2c1d22604cbcc8c49" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_payments_status" ON "payment_transactions" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_payments_user_id" ON "payment_transactions" ("userId") `);
        await queryRunner.query(`CREATE INDEX "idx_payments_booking_id" ON "payment_transactions" ("bookingId") `);
        await queryRunner.query(`CREATE TYPE "public"."bookings_bookingtype_enum" AS ENUM('ticket', 'table', 'apartment', 'car')`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_status_enum" AS ENUM('INITIATED', 'PENDING_PAYMENT', 'PENDING_GROUP_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_paymentstatus_enum" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingType" "public"."bookings_bookingtype_enum" NOT NULL, "userId" uuid NOT NULL, "groupId" uuid, "resourceId" uuid NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'INITIATED', "guestCount" integer, "basePrice" numeric(12,2) NOT NULL, "platformCommission" numeric(12,2) NOT NULL DEFAULT '0', "serviceCharge" numeric(12,2) NOT NULL DEFAULT '0', "totalAmount" numeric(12,2) NOT NULL, "paymentStatus" "public"."bookings_paymentstatus_enum" NOT NULL DEFAULT 'UNPAID', "paymentMethod" character varying(50), "checkInTime" TIMESTAMP, "completedAt" TIMESTAMP, "cancelledAt" TIMESTAMP, "expiresAt" TIMESTAMP, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_bookings_group_id" ON "bookings" ("groupId") `);
        await queryRunner.query(`CREATE INDEX "idx_bookings_status" ON "bookings" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_bookings_type" ON "bookings" ("bookingType") `);
        await queryRunner.query(`CREATE INDEX "idx_bookings_user_id" ON "bookings" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('CREATED', 'ASSIGNED', 'ROUTED', 'IN_PREPARATION', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "userId" uuid NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'CREATED', "items" jsonb NOT NULL, "totalAmount" numeric(12,2) NOT NULL, "assignedToUserId" uuid, "routedToStationId" uuid, "readyAt" TIMESTAMP, "servedAt" TIMESTAMP, "completedAt" TIMESTAMP, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_orders_assigned_to" ON "orders" ("assignedToUserId") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_status" ON "orders" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_user_id" ON "orders" ("userId") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_booking_id" ON "orders" ("bookingId") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('customer', 'waiter', 'kitchen_staff', 'bar_staff', 'door_staff', 'manager', 'admin', 'super_admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "phone" character varying(20), "passwordHash" character varying(255) NOT NULL, "firstName" character varying(100), "lastName" character varying(100), "role" "public"."users_role_enum" NOT NULL DEFAULT 'customer', "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_actiontype_enum" AS ENUM('BOOKING_CREATED', 'BOOKING_UPDATED', 'PAYMENT_PROCESSED', 'PAYMENT_REFUNDED', 'ORDER_CREATED', 'ORDER_ASSIGNED', 'ORDER_COMPLETED', 'ADMIN_OVERRIDE', 'USER_CREATED', 'USER_UPDATED')`);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_actorrole_enum" AS ENUM('customer', 'waiter', 'kitchen_staff', 'bar_staff', 'door_staff', 'manager', 'admin', 'super_admin')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actionType" "public"."audit_logs_actiontype_enum" NOT NULL, "actorId" uuid, "actorRole" "public"."audit_logs_actorrole_enum", "resourceType" character varying(100), "resourceId" uuid, "changes" jsonb, "ipAddress" character varying(50), "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "prevHash" character varying, "hash" character varying NOT NULL, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_audit_action_type" ON "audit_logs" ("actionType") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_timestamp" ON "audit_logs" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_resource_id" ON "audit_logs" ("resourceId") `);
        await queryRunner.query(`CREATE TABLE "financial_ledger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid, "transactionType" character varying(20) NOT NULL, "amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NGN', "description" text NOT NULL, "relatedUserId" uuid, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_086e17880c037323aabed181229" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_ledger_user_id" ON "financial_ledger" ("relatedUserId") `);
        await queryRunner.query(`CREATE INDEX "idx_ledger_timestamp" ON "financial_ledger" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "idx_ledger_booking_id" ON "financial_ledger" ("bookingId") `);
        await queryRunner.query(`CREATE TABLE "queues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "venueId" uuid NOT NULL, "userId" uuid NOT NULL, "position" integer NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'WAITING', "calledAt" TIMESTAMP, "checkedInAt" TIMESTAMP, "cancelledAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d966f9eb39a9396658387071bb3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_queue_status" ON "queues" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_queue_user_id" ON "queues" ("userId") `);
        await queryRunner.query(`CREATE INDEX "idx_queue_venue_id" ON "queues" ("venueId") `);
        await queryRunner.query(`CREATE TABLE "group_bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "initiatorId" uuid NOT NULL, "participantIds" text NOT NULL, "contributionTracker" jsonb NOT NULL, "totalRequired" numeric(12,2) NOT NULL, "totalPaid" numeric(12,2) NOT NULL DEFAULT '0', "countdownExpiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4d215dc6aea884c8b43bcc6803f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_group_initiator_id" ON "group_bookings" ("initiatorId") `);
        await queryRunner.query(`CREATE INDEX "idx_group_booking_id" ON "group_bookings" ("bookingId") `);
        await queryRunner.query(`ALTER TABLE "wallets" ADD CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_d3621540be4bed2af9119106971" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_60b852936ca1e980cce98d977a2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_38a69a58a323647f2e75eb994de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_69584b65ba4a4212d9073b5eb00" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_69584b65ba4a4212d9073b5eb00"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_38a69a58a323647f2e75eb994de"`);
        await queryRunner.query(`ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_60b852936ca1e980cce98d977a2"`);
        await queryRunner.query(`ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_d3621540be4bed2af9119106971"`);
        await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97"`);
        await queryRunner.query(`DROP INDEX "public"."idx_group_booking_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_group_initiator_id"`);
        await queryRunner.query(`DROP TABLE "group_bookings"`);
        await queryRunner.query(`DROP INDEX "public"."idx_queue_venue_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_queue_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_queue_status"`);
        await queryRunner.query(`DROP TABLE "queues"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ledger_booking_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ledger_timestamp"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ledger_user_id"`);
        await queryRunner.query(`DROP TABLE "financial_ledger"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_resource_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_timestamp"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_action_type"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_actorrole_enum"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_actiontype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_booking_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_assigned_to"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bookings_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bookings_type"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bookings_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bookings_group_id"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_paymentstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_bookingtype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_booking_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_status"`);
        await queryRunner.query(`DROP TABLE "payment_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."payment_transactions_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_wallets_user_id"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
    }

}
