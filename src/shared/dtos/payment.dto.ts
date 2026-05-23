import { IsNumber, IsEnum, IsOptional, IsUUID, IsPositive, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @IsUUID()
  bookingId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(['wallet', 'paystack'])
  method: 'wallet' | 'paystack';

  @IsOptional()
  @IsString()
  paystackReference?: string;
}

export class RefundPaymentDto {
  @IsUUID()
  paymentId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class WalletTopupDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(['paystack'])
  method: 'paystack';
}

export class PaymentTransactionResponseDto {
  id: string;
  bookingId: string;
  amount: number;
  status: string;
  paymentMethod: string;
  createdAt: Date;
  completedAt?: Date;
}

export class WalletResponseDto {
  id: string;
  balance: number;
  currency: string;
  lastTransactionAt?: Date;
}