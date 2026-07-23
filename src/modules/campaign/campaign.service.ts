import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationCampaign } from '../../shared/entities/notification-campaign.entity';
import { CampaignTier } from '../../shared/entities/campaign-tier.entity';
import { User } from '../../shared/entities/user.entity';
import { AuditService }  from '../audit/audit.service';
import { WalletService } from '../payments/wallet.service';
import { NotificationService } from '../notifications/notifications.service';
import { AuditActionType, UserRole, BusinessScope } from '../../shared/enums';
import { IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString() title: string;
  @IsString() body: string;
  @IsString() targetScope: BusinessScope | 'ALL';
  @IsString() tierId: string;
}

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(NotificationCampaign)
    private readonly repo: Repository<NotificationCampaign>,
    @InjectRepository(CampaignTier)
    private readonly tierRepo: Repository<CampaignTier>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: AuditService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── Tiers ───────────────────────────────────────────────────────────────────

  async listTiers(): Promise<CampaignTier[]> {
    return this.tierRepo.find({ where: { isActive: true }, order: { maxRecipients: 'ASC' } });
  }

  // ─── Campaign CRUD ─────────────────────────────────────────────────────────

  async create(dto: CreateCampaignDto, createdBy: string): Promise<NotificationCampaign> {
    const tier = await this.tierRepo.findOne({ where: { id: dto.tierId, isActive: true } });
    if (!tier) throw new BadRequestException('Selected pricing tier not found or inactive');

    const campaign = this.repo.create({
      title: dto.title,
      body: dto.body,
      targetScope: dto.targetScope,
      tierId: tier.id,
      createdBy,
      status: 'DRAFT',
    });
    return this.repo.save(campaign);
  }

  async list(params: { limit?: number; offset?: number }) {
    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    });
    return { data, total };
  }

  async findOne(id: string): Promise<NotificationCampaign> {
    const campaign = await this.repo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  // ─── Eligibility ─────────────────────────────────────────────────────────────

  /**
   * targetScope (ALL / CAR_RENTAL / APARTMENT / TABLE_CLUB / EVENT_TICKETING)
   * is a LABEL on the campaign for the admin's own organization/reporting —
   * e.g. "this was our car-rental push" — it does NOT filter who receives
   * it. Every notification, regardless of scope, goes to the same pool: all
   * active customers, capped by the chosen tier. A car-rental promo should
   * reach people who've never rented a car too, not just past renters —
   * restricting by booking history would undercut exactly the growth a
   * promo is meant to drive.
   */
  private async getEligibleUserIds(): Promise<string[]> {
    const users = await this.userRepo.find({
      where: { role: UserRole.CUSTOMER, isActive: true },
      select: ['id'],
    });
    return users.map((u) => u.id);
  }

  // ─── Send ────────────────────────────────────────────────────────────────────

  async send(id: string, adminId: string, ipAddress: string): Promise<NotificationCampaign> {
    const campaign = await this.findOne(id);

    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException(`Campaign is already ${campaign.status}`);
    }
    if (!campaign.tierId) {
      throw new BadRequestException('Campaign has no pricing tier selected');
    }

    const tier = await this.tierRepo.findOne({ where: { id: campaign.tierId } });
    if (!tier) throw new BadRequestException('The pricing tier for this campaign no longer exists');

    const eligibleUserIds = await this.getEligibleUserIds();

    // Hard cap — never exceed what was paid for, even if the real audience
    // is larger. If the real audience is smaller, everyone eligible gets it;
    // the tier price is flat regardless (same as buying an ad package that
    // caps impressions — under-delivery isn't refunded, over-delivery isn't allowed).
    const recipientIds = eligibleUserIds.slice(0, tier.maxRecipients);

    if (recipientIds.length === 0) {
      throw new BadRequestException('No eligible recipients found for this target scope');
    }

    const totalFee = Number(tier.price);

    // Debit admin wallet BEFORE sending — throws if insufficient balance,
    // so nothing goes out if payment fails.
    try {
      await this.walletService.debit(
        adminId,
        totalFee,
        `Campaign fee: ${campaign.title} (${tier.label})`,
        ipAddress,
      );
    } catch (err: any) {
      throw new BadRequestException(
        err?.message ?? 'Insufficient wallet balance for campaign fee',
      );
    }

    // Actually send — this call was missing entirely before; the campaign
    // used to be marked SENT without ever reaching NotificationService.
    await this.notificationService.sendBulkNotification(
      recipientIds,
      campaign.title,
      campaign.body,
      { campaignId: campaign.id },
      'promo',
    );

    campaign.status = 'SENT';
    campaign.sentAt = new Date();
    campaign.recipientCount = recipientIds.length;
    campaign.tierMaxRecipients = tier.maxRecipients;
    campaign.feePaid = totalFee;
    campaign.paymentStatus = 'PAID';

    const saved = await this.repo.save(campaign);

    await this.auditService.logAction({
      actionType: AuditActionType.CAMPAIGN_FEE_CHARGED,
      actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'notification_campaign', resourceId: id,
      changes: { recipientCount: recipientIds.length, feePaid: totalFee, tier: tier.label, targetScope: campaign.targetScope },
      ipAddress,
    });

    await this.auditService.logAction({
      actionType: AuditActionType.CAMPAIGN_SENT,
      actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'notification_campaign', resourceId: id,
      changes: { recipientCount: recipientIds.length, eligibleCount: eligibleUserIds.length, targetScope: campaign.targetScope },
      ipAddress,
    });

    return saved;
  }
}
