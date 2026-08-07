import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `audit_logs.actionType` column is a native Postgres enum
 * (audit_logs_actiontype_enum). The TypeScript AuditActionType enum has
 * grown well beyond the original 10 values it was created with, but no
 * migration ever added the new values to the actual database type.
 *
 * Any code path that logs one of the newer action types (SETTINGS_UPDATED,
 * INVENTORY_ITEM_CREATED, etc.) throws a raw Postgres error —
 * "invalid input value for enum audit_logs_actiontype_enum" — which
 * surfaces to the client as an unhandled 500. This was the root cause of
 * the platform-settings save failure, inventory item creation failures,
 * and would have hit campaign-send and several other flows too.
 *
 * Postgres requires each ADD VALUE to run as its own statement (can't be
 * combined with other ALTER TYPE statements in one call), but running them
 * sequentially in this migration's transaction is fine on Postgres 12+.
 */
const MISSING_VALUES = [
  'BOOKING_CANCELLED',
  'BOOKING_EXPIRED',
  'BOOKING_CHECKED_IN',
  'TICKET_SCANNED',
  'STAFF_DEACTIVATED',
  'STAFF_SCOPE_UPDATED',
  'SETTINGS_UPDATED',
  'CAMPAIGN_SENT',
  'CAMPAIGN_FEE_CHARGED',
  'INVENTORY_RESTOCKED',
  'INVENTORY_DEDUCTED',
  'INVENTORY_ITEM_CREATED',
  'REFUND_INITIATED',
  'WALLET_CREDITED',
  'QUEUE_ADVANCED',
  'QUEUE_CLOSED',
  'CAUTION_FEE_REFUNDED',
  'CAUTION_FEE_FORFEITED',
  'PRICE_UPDATED',
];

export class SyncAuditActionTypeEnum1782700000000 implements MigrationInterface {
  name = 'SyncAuditActionTypeEnum1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of MISSING_VALUES) {
      await queryRunner.query(
        `ALTER TYPE "public"."audit_logs_actiontype_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Postgres doesn't support removing values from an enum type. Reverting
    // this migration is a no-op — the extra values are harmless if unused.
  }
}
