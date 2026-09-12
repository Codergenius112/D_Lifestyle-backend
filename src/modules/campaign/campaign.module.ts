import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationCampaign } from '../../shared/entities/notification-campaign.entity';
import { CampaignTier } from '../../shared/entities/campaign-tier.entity';
import { User } from '../../shared/entities/user.entity';
import { CampaignService }        from './campaign.service';
import { CampaignController }     from './campaign.controller';
import { AuditModule }            from '../audit/audit.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PaymentsModule }         from '../payments/payments.module';
import { NotificationsModule }    from '../notifications/notifications.module';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy — campaigns gap fix)

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationCampaign, CampaignTier, User]),
    AuditModule,
    PlatformSettingsModule,
    PaymentsModule,
    NotificationsModule,
  ],
  providers:   [CampaignService, BusinessContextService], // ← CHANGED (multi-tenancy — campaigns gap fix)
  controllers: [CampaignController],
  exports:     [CampaignService],
})
export class CampaignModule {}