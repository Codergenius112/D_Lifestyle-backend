import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ValidationService {
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone);
  }

  validateBookingCapacity(guestCount: number, maxCapacity: number): void {
    if (guestCount > maxCapacity) {
      throw new BadRequestException(
        `Guest count (${guestCount}) exceeds maximum capacity (${maxCapacity})`,
      );
    }
  }

  validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }
  }

  validateAmount(amount: number, minAmount = 0, maxAmount = Number.MAX_SAFE_INTEGER): void {
    if (amount < minAmount || amount > maxAmount) {
      throw new BadRequestException(
        `Amount must be between ${minAmount} and ${maxAmount}`,
      );
    }
  }
}
