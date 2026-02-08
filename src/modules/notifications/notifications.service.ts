import { Injectable } from '@nestjs/common';
import { Queue as BullQueue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue('notifications')
    private notificationQueue: BullQueue,
  ) {}

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    // Queue notification job for async processing
    await this.notificationQueue.add(
      'send',
      {
        userId,
        title,
        message,
        data,
        type: 'push', // push, email, in-app
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  async sendBulkNotification(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const jobs = userIds.map((userId) =>
      this.notificationQueue.add('send', {
        userId,
        title,
        message,
        data,
        type: 'push',
      }),
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
      {
        userId,
        title,
        message,
        data,
        type: 'push',
      },
      {
        delay: delaySeconds * 1000,
      },
    );
  }
}