import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue as BullQueue } from 'bull';
import { DeviceToken } from '../../shared/entities/device-token.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue('notifications')
    private notificationQueue: BullQueue,

    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
  ) {}

  // ─── Token Registration ──────────────────────────────────────────────────────

  /**
   * Registers or re-activates a push token for the authenticated user.
   * Idempotent — safe to call every time the app launches.
   */
  async registerToken(
    userId: string,
    token: string,
    platform: 'expo' | 'fcm' | 'apns' = 'expo',
  ): Promise<DeviceToken> {
    // Check if token already exists (could belong to this or another user
    // e.g. if device was passed to someone else)
    const existing = await this.deviceTokenRepo.findOne({ where: { token } });

    if (existing) {
      // Re-assign to current user and re-activate if needed
      existing.userId   = userId;
      existing.isActive = true;
      existing.platform = platform;
      return this.deviceTokenRepo.save(existing);
    }

    const deviceToken = this.deviceTokenRepo.create({ userId, token, platform, isActive: true });
    return this.deviceTokenRepo.save(deviceToken);
  }

  /**
   * Deactivates a token — called when the user logs out so they
   * stop receiving notifications on that device.
   */
  async removeToken(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepo.update(
      { userId, token },
      { isActive: false },
    );
  }

  /**
   * Returns all active push tokens for a given user across all their devices.
   */
  async getTokensForUser(userId: string): Promise<string[]> {
    const tokens = await this.deviceTokenRepo.find({
      where: { userId, isActive: true },
      select: ['token'],
    });
    return tokens.map((t) => t.token);
  }

  /**
   * Marks a token as inactive — called by the processor when FCM
   * reports a token as invalid/expired so we stop wasting sends.
   */
  async deactivateToken(token: string): Promise<void> {
    await this.deviceTokenRepo.update({ token }, { isActive: false });
    this.logger.warn(`Deactivated stale push token: ${token.substring(0, 20)}...`);
  }

  // ─── Sending ─────────────────────────────────────────────────────────────────

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const tokens = await this.getTokensForUser(userId);

    if (tokens.length === 0) {
      this.logger.log(`No active push tokens for user ${userId} — skipping`);
      return;
    }

    await this.notificationQueue.add(
      'send',
      { userId, tokens, title, message, data, type: 'push' },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
  }

  async sendBulkNotification(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    // Fan out — one job per user so failures are isolated
    const jobs = userIds.map((userId) =>
      this.notificationQueue.add(
        'send',
        { userId, title, message, data, type: 'push' },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      ),
    );
    await Promise.all(jobs);
  }

  async scheduleNotification(
    userId: string,
    title: string,
    message: string,
    delaySeconds: number,
    data?: Record<string, any>,
  ): Promise<void> {
    await this.notificationQueue.add(
      'send',
      { userId, title, message, data, type: 'push' },
      { delay: delaySeconds * 1000 },
    );
  }
}