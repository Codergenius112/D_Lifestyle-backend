import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationCampaign } from '../../shared/entities/notification-campaign.entity';
import { AuditService }            from '../audit/audit.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { WalletService }           from '../payments/wallet.service';
import { AuditActionType, UserRole, BusinessScope } from '../../shared/enums';
import { IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString() title: string;
  @IsString() body: string;
  @IsString() targetScope: BusinessScope | 'ALL';
}

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(NotificationCampaign)
    private readonly repo: Repository<NotificationCampaign>,
    private readonly auditService: AuditService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly walletService: WalletService,
  ) {}

  async create(dto: CreateCampaignDto, createdBy: string): Promise<NotificationCampaign> {
    const campaign = this.repo.create({ ...dto, createdBy, status: 'DRAFT' });
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

  async send(id: string, adminId: string, ipAddress: string): Promise<NotificationCampaign> {
    const campaign = await this.findOne(id);

    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException(`Campaign is already ${campaign.status}`);
    }

    const settings = await this.platformSettingsService.getSettings();
    const fee = Number(settings.pushNotificationFee);

    // TODO: replace with real recipient count query
    const recipientCount = 50;
    const totalFee = fee * recipientCount;

    // Debit admin wallet before sending — throws if insufficient balance
    if (totalFee > 0) {
      try {
        await this.walletService.debit(
          adminId,
          totalFee,
          `Campaign fee: ${campaign.title}`,
          ipAddress,
        );
      } catch (err: any) {
        throw new BadRequestException(
          err?.message ?? 'Insufficient wallet balance for campaign fee',
        );
      }
    }

    campaign.status = 'SENT';
    campaign.sentAt = new Date();
    campaign.recipientCount = recipientCount;
    campaign.feePaid = totalFee;
    campaign.paymentStatus = totalFee > 0 ? 'PAID' : 'UNPAID';

    const saved = await this.repo.save(campaign);

    await this.auditService.logAction({
      actionType: AuditActionType.CAMPAIGN_FEE_CHARGED,
      actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'notification_campaign', resourceId: id,
      changes: { recipientCount, feePaid: totalFee, targetScope: campaign.targetScope },
      ipAddress,
    });

    await this.auditService.logAction({
      actionType: AuditActionType.CAMPAIGN_SENT,
      actorId: adminId, actorRole: UserRole.ADMIN,
      resourceType: 'notification_campaign', resourceId: id,
      changes: { recipientCount, targetScope: campaign.targetScope },
      ipAddress,
    });

    return saved;
  }
}