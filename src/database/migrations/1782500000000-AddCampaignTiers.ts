import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignTiers1782500000000 implements MigrationInterface {
  name = 'AddCampaignTiers1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "campaign_tiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" varchar(100) NOT NULL,
        "maxRecipients" integer NOT NULL,
        "price" decimal(12,2) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_campaign_tiers" PRIMARY KEY ("id")
      )
    `);

    // Seed two starting tiers matching the ₦5k / ₦10k example — admins can
    // edit these prices and caps, or add more tiers, from the admin panel
    // once that UI exists; these are just sensible starting points.
    await queryRunner.query(`
      INSERT INTO "campaign_tiers" ("label", "maxRecipients", "price")
      VALUES
        ('Starter', 1000, 5000.00),
        ('Growth',  5000, 10000.00)
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_campaigns"
      ADD COLUMN IF NOT EXISTS "tierId" uuid,
      ADD COLUMN IF NOT EXISTS "tierMaxRecipients" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_campaigns"
      DROP COLUMN IF EXISTS "tierId",
      DROP COLUMN IF EXISTS "tierMaxRecipients"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "campaign_tiers"`);
  }
}
