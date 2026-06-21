import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommissionPayerColumns1780900000000 implements MigrationInterface {
  name = 'AddCommissionPayerColumns1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add commissionPayer to events
    await queryRunner.query(`
      ALTER TABLE events
        ADD COLUMN IF NOT EXISTS "commissionPayer" VARCHAR(10) NOT NULL DEFAULT 'USER';
    `);

    // 2. Make venueId nullable in events
    await queryRunner.query(`
      ALTER TABLE events
        ALTER COLUMN "venueId" DROP NOT NULL;
    `);

    // 3. Create platform_settings if it doesn't exist (gap migration may not have run)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "serviceCharge"       DECIMAL(12,2) NOT NULL DEFAULT 400,
        "commissionRate"      DECIMAL(5,4)  NOT NULL DEFAULT 0.03,
        "pushNotificationFee" DECIMAL(12,2) NOT NULL DEFAULT 5000,
        "commissionPayer"     VARCHAR(10)   NOT NULL DEFAULT 'USER',
        "updatedBy"           UUID,
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 4. Add commissionPayer column if table already existed without it
    await queryRunner.query(`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS "commissionPayer" VARCHAR(10) NOT NULL DEFAULT 'USER';
    `);

    // 5. Seed a default row if table is empty
    await queryRunner.query(`
      INSERT INTO platform_settings ("id")
        SELECT gen_random_uuid()
        WHERE NOT EXISTS (SELECT 1 FROM platform_settings LIMIT 1);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE platform_settings DROP COLUMN IF EXISTS "commissionPayer"`);
    await queryRunner.query(`ALTER TABLE events ALTER COLUMN "venueId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE events DROP COLUMN IF EXISTS "commissionPayer"`);
  }
}
