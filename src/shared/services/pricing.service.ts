import { Injectable } from '@nestjs/common';

@Injectable()
export class PricingService {
  private readonly platformCommissionRate = 0.03; // 3%
  private readonly serviceCharge = parseInt(process.env.SERVICE_CHARGE || '400');

  calculateBookingFees(basePrice: number): {
    basePrice: number;
    platformCommission: number;
    serviceCharge: number;
    totalAmount: number;
    venueNet: number;
  } {
    const platformCommission = basePrice * this.platformCommissionRate;
    const venueNet = basePrice - platformCommission;
    const totalAmount = basePrice + this.serviceCharge;

    return {
      basePrice,
      platformCommission,
      serviceCharge: this.serviceCharge,
      totalAmount,
      venueNet,
    };
  }

  calculateGroupBookingShare(
    totalAmount: number,
    participantCount: number,
  ): number {
    return totalAmount / participantCount;
  }

  calculateRefundAmount(
    basePrice: number,
    serviceCharge: number,
    isServiceChargeRefundable = false,
  ): number {
    if (isServiceChargeRefundable) {
      return basePrice + serviceCharge;
    }
    return basePrice;
  }

  getEffectiveRate(): number {
    return this.platformCommissionRate;
  }

  getServiceCharge(): number {
    return this.serviceCharge;
  }
}