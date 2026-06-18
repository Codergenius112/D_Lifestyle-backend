import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../../shared/entities/platform-settings.entity';
import { AuditService } from '../audit/audit.service';
import { AuditActionType, UserRole } from '../../shared/enums';

@Injectable()
export class PlatformSettingsService {
  private readonly SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly repo: Repository<PlatformSettings>,
    private readonly auditService: AuditService,
  ) {}

  async getSettings(): Promise<PlatformSettings> {
    let settings = await this.repo.findOne({ where: { id: this.SINGLETON_ID } });
    if (!settings) {
      settings = this.repo.create({ id: this.SINGLETON_ID });
      await this.repo.save(settings);
    }
    return settings;
  }

  async updateSettings(
    dto: Partial<Pick<PlatformSettings, 'serviceCharge' | 'commissionRate' | 'commissionPayer' | 'pushNotificationFee'>>,
    actorId: string,
    ipAddress: string,
  ): Promise<PlatformSettings> {
    const current = await this.getSettings();
    const before = {
      serviceCharge: current.serviceCharge,
      commissionRate: current.commissionRate,
      commissionPayer: current.commissionPayer,
      pushNotificationFee: current.pushNotificationFee,
    };

    Object.assign(current, dto, { updatedBy: actorId });
    const updated = await this.repo.save(current);

    await this.auditService.logAction({
      actionType: AuditActionType.SETTINGS_UPDATED,
      actorId,
      actorRole: UserRole.SUPER_ADMIN,
      resourceType: 'platform_settings',
      resourceId: this.SINGLETON_ID,
      changes: { before, after: dto },
      ipAddress,
    });

    return updated;
  }
}