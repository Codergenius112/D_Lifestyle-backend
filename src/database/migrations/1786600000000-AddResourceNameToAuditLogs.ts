import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourceNameToAuditLogs1786600000000 implements MigrationInterface {
  name = 'AddResourceNameToAuditLogs1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN "resourceName" varchar(200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN "resourceName"
    `);
  }
}