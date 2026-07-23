import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue as BullQueue } from 'bull';
import { DeviceToken } from '../../shared/entities/device-token.entity';
import { Notification } from '../../shared/entities/notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue('notifications')
    private notificationQueue: BullQueue,

    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,

    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
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
  // Every send persists a Notification row FIRST, then queues the push job.
  // The row is the source of truth for "what did we tell this user" — it
  // exists regardless of whether they had a device token, whether the push
  // succeeded, or whether the BullMQ job has since been cleaned up.

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>,
    type: string = 'general',
  ): Promise<Notification> {
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({ userId, title, message, type, data: data ?? null }),
    );

    const tokens = await this.getTokensForUser(userId);
    if (tokens.length === 0) {
      this.logger.log(`No active push tokens for user ${userId} — notification saved, push skipped`);
      return notification;
    }

    await this.notificationQueue.add(
      'send',
      { userId, tokens, title, message, data, type: 'push' },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    return notification;
  }

  async sendBulkNotification(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
    type: string = 'general',
  ): Promise<void> {
    // Persist one row per recipient
    const rows = userIds.map((userId) =>
      this.notificationRepo.create({ userId, title, message, type, data: data ?? null }),
    );
    await this.notificationRepo.save(rows);

    // Fan out push jobs — one job per user so failures are isolated
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
    type: string = 'general',
  ): Promise<Notification> {
    // Saved immediately so it's visible right away even though the push
    // itself won't fire until the delay elapses — matches how the rest of
    // the app treats "booked" vs "delivered" as separate concerns.
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({ userId, title, message, type, data: data ?? null }),
    );

    await this.notificationQueue.add(
      'send',
      { userId, title, message, data, type: 'push' },
      { delay: delaySeconds * 1000 },
    );

    return notification;
  }

  // ─── Reading (what the mobile Activity screen actually calls) ────────────────

  async getUserNotifications(userId: string, limit = 30, offset = 0) {
    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    const unreadCount = await this.notificationRepo.count({ where: { userId, isRead: false } });
    return { notifications, total, unreadCount };
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
  }
}
