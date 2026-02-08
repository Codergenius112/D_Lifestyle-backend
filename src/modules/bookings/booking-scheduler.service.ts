import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LateArrivalService } from './late-arrival.service';
import { GroupBookingCountdownService } from './group-booking-countdown.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class BookingSchedulerService {
  private logger = new Logger(BookingSchedulerService.name);

  constructor(
    private lateArrivalService: LateArrivalService,
    private groupBookingCountdownService: GroupBookingCountdownService,
  ) {}

  @Cron('0 */5 * * * *') // Every 5 minutes
  async handleLateArrivals() {
    try {
      this.logger.log('Running late arrival check...');
      await this.lateArrivalService.checkAndHandleLateArrivals();
    } catch (error) {
  if (error instanceof Error) {
    this.logger.error('Error in late arrival check:', error.message);
  } else {
    this.logger.error('Error in late arrival check:', String(error));
  }
}}

  @Cron('0 */1 * * * *') // Every minute
  async handleGroupBookingExpirations() {
    try {
      this.logger.log('Checking group booking expirations...');
      await this.groupBookingCountdownService.checkAndExpireGroupBookings();
    } catch (error) {
  if (error instanceof Error) {
    this.logger.error('Error checking group booking expirations:', error.message);
  } else {
    this.logger.error('Error checking group booking expirations:', String(error));
  }
}}
}

