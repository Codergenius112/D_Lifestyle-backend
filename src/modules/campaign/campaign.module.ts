import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationCampaign } from '../../shared/entities/notification-campaign.entity';
import { CampaignService }        from './campaign.service';
import { CampaignController }     from './campaign.controller';
import { AuditModule }            from '../audit/audit.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PaymentsModule }         from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationCampaign]),
    AuditModule,
    PlatformSettingsModule,
    PaymentsModule,
  ],
  providers:   [CampaignService],
  controllers: [CampaignController],
  exports:     [CampaignService],
})
export class CampaignModule {}