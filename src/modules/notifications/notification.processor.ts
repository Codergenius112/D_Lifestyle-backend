import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { Expo, ExpoPushMessage, ExpoPushToken, ExpoPushTicket } from 'expo-server-sdk';

/**
 * NotificationProcessor
 *
 * Processes queued push notification jobs using Expo's push API.
 * Expo handles the FCM/APNs delivery so we don't need separate
 * firebase-admin and apple certificates for now.
 *
 * Setup:
 *   npm install expo-server-sdk
 *
 * To upgrade to raw FCM later, replace the Expo block with
 * firebase-admin's messaging.sendMulticast().
 */

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private expo: Expo;

  constructor(private notificationService: NotificationService) {
    this.expo = new Expo();
  }

  @Process('send')
  async handleSendNotification(job: Job) {
    const { userId, tokens, title, message, data } = job.data;

    // Resolve tokens (either passed or fetched)
    const pushTokens: string[] = tokens?.length
      ? tokens
      : await this.notificationService.getTokensForUser(userId);

    if (!pushTokens.length) {
      this.logger.log(`No tokens for user ${userId} — skipping job`);
      return { success: true, sent: 0 };
    }

    this.logger.log(
      `Sending push to ${pushTokens.length} device(s) for user ${userId}: "${title}"`,
    );

    // Filter valid Expo tokens and build messages
    const messages: ExpoPushMessage[] = pushTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: 'default',
        title,
        body: message,
        data: data || {},
      }));

    if (!messages.length) {
      this.logger.warn(`No valid Expo tokens for user ${userId}`);
      return { success: true, sent: 0 };
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    const receipts: ExpoPushTicket[] = [];

    // Send notifications in chunks
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        receipts.push(...ticketChunk);
      } catch (err: any) {
        this.logger.error(`Expo chunk send failed: ${err.message}`);
      }
    }

    // Map tokens safely (important)
    const messageTokenMap = messages.map((msg) => msg.to);

    // Handle errors and deactivate invalid tokens
for (let i = 0; i < receipts.length; i++) {
  const receipt = receipts[i];

  if (receipt.status === 'error') {
    this.logger.warn(`Push error: ${receipt.message}`);

    if (
      receipt.details?.error === 'DeviceNotRegistered' ||
      receipt.details?.error === 'InvalidCredentials'
    ) {
      const badToken = messageTokenMap[i];

      if (badToken) {
        const tokens = Array.isArray(badToken) ? badToken : [badToken];

        for (const token of tokens) {
          await this.notificationService.deactivateToken(token);
        }
      }
    }
  }
}

    this.logger.log(
      `Push sent to ${messages.length} device(s) for user ${userId}`,
    );

    return { success: true, sent: messages.length };
  }
}