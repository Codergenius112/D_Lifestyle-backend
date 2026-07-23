import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

// Admin-configurable pricing bands for notification campaigns — e.g.
// "₦5,000 → up to 1,000 recipients", "₦10,000 → up to 5,000 recipients".
// A real table rather than hardcoded values so pricing can be tuned without
// a deploy. Campaigns snapshot the tier's price/cap at send time onto the
// campaign row itself, so editing a tier later never rewrites history.
@Entity('campaign_tiers')
export class CampaignTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  label: string; // e.g. "Starter", "Growth", "Reach"

  @Column({ type: 'integer' })
  maxRecipients: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
