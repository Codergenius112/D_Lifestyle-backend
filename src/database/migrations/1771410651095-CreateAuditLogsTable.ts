import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuditLogsTable1771410651095 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // required for hashing
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },

          { name: 'actionType', type: 'varchar', length: '100' },

          { name: 'actorId', type: 'uuid', isNullable: true },
          { name: 'actorRole', type: 'varchar', length: '50', isNullable: true },

          { name: 'actorFingerprint', type: 'varchar', length: '128', isNullable: true },
          { name: 'requestId', type: 'uuid', isNullable: true },

          { name: 'resourceType', type: 'varchar', length: '100', isNullable: true },
          { name: 'resourceId', type: 'uuid', isNullable: true },

          { name: 'changes', type: 'jsonb', isNullable: true },

          { name: 'ipAddress', type: 'varchar', length: '50', isNullable: true },
          { name: 'userAgentHash', type: 'varchar', length: '128', isNullable: true },

          { name: 'previousHash', type: 'text', isNullable: true },
          { name: 'rowHash', type: 'text', isNullable: false },

          { name: 'timestamp', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    // Indexes for investigations
    await queryRunner.createIndex('audit_logs', new TableIndex({ name: 'idx_audit_actor', columnNames: ['actorId'] }));
    await queryRunner.createIndex('audit_logs', new TableIndex({ name: 'idx_audit_resource', columnNames: ['resourceId'] }));
    await queryRunner.createIndex('audit_logs', new TableIndex({ name: 'idx_audit_request', columnNames: ['requestId'] }));
    await queryRunner.createIndex('audit_logs', new TableIndex({ name: 'idx_audit_timestamp', columnNames: ['timestamp'] }));

    // ---- HASH CHAIN FUNCTION ----
    await queryRunner.query(`
    CREATE OR REPLACE FUNCTION audit_logs_compute_hash()
    RETURNS TRIGGER AS $$
    DECLARE prev_hash TEXT;
    BEGIN
      SELECT rowHash INTO prev_hash
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT 1;

      NEW.previousHash := prev_hash;

      NEW.rowHash :=
        encode(
          digest(
            coalesce(prev_hash,'') ||
            coalesce(NEW.id::text,'') ||
            coalesce(NEW.actionType,'') ||
            coalesce(NEW.actorId::text,'') ||
            coalesce(NEW.resourceId::text,'') ||
            coalesce(NEW.timestamp::text,''),
            'sha256'
          ),
          'hex'
        );

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER audit_hash_chain
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION audit_logs_compute_hash();
    `);

    // ---- IMMUTABILITY ----
    await queryRunner.query(`
    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit logs are immutable';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

    CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    `);
  }

    public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_delete ON audit_logs;
      DROP TRIGGER IF EXISTS prevent_audit_update ON audit_logs;
      DROP TRIGGER IF EXISTS audit_hash_chain ON audit_logs;

      DROP FUNCTION IF EXISTS prevent_audit_modification;
      DROP FUNCTION IF EXISTS audit_logs_compute_hash;
    `);

    await queryRunner.dropTable('audit_logs');
  }
}
