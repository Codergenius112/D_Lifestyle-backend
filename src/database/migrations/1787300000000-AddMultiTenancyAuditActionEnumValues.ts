import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the multi-tenancy audit action types (introduced alongside Business,
 * StaffBusinessAssignment, and BusinessDataShare in Phase 0) to the actual
 * Postgres enum type. Without this, any auditService.logAction() call using
 * one of these new action types fails at the database level even though it
 * type-checks fine in TypeScript — the app-level enum and the DB enum are
 * two separate things and must be kept in sync explicitly.
 */
export class AddMultiTenancyAuditActionEnumValues1787300000000 implements MigrationInterface {
  name = 'AddMultiTenancyAuditActionEnumValues1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const values = [
      'BUSINESS_CREATED',
      'BUSINESS_STATUS_CHANGED',
      'STAFF_ASSIGNMENT_CREATED',
      'STAFF_ASSIGNMENT_REVOKED',
      'DATA_SHARE_GRANTED',
      'DATA_SHARE_REVOKED',
    ];
    for (const value of values) {
      await queryRunner.query(`
        ALTER TYPE "audit_logs_actiontype_enum"
        ADD VALUE IF NOT EXISTS '${value}'
      `);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing a value from an enum type directly.
    // A rollback would require recreating the enum type and column, which
    // is destructive — intentionally left as a no-op (matches the existing
    // convention in this codebase, see 1786600000001).
  }
}
