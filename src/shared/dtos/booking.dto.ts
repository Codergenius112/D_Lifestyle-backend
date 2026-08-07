import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsPositive,
  IsDateString,
  IsObject,
  IsString,
} from 'class-validator';
import { BookingType } from '../enums';

export class CreateBookingDto {
  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsUUID()
  resourceId: string;

  @IsNumber()
  @IsPositive()
  basePrice: number;

  @IsNumber()
  @IsPositive()
  guestCount: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateGroupBookingDto extends CreateBookingDto {
  @IsArray()
  @IsUUID('all', { each: true })
  participantIds: string[];
}

export class ContributeToGroupBookingDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

export enum AdminOverridableBookingStatus {
  CONFIRMED  = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED  = 'COMPLETED',
  CANCELLED  = 'CANCELLED',
}

export class UpdateBookingStatusDto {
  @IsEnum(AdminOverridableBookingStatus)
  status: AdminOverridableBookingStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BookingResponseDto {
  id: string;
  bookingType: BookingType;
  status: string;
  basePrice: number;
  serviceCharge: number;
  platformCommission: number;
  totalAmount: number;
  paymentStatus: string;
  guestCount: number;
  createdAt: Date;
  updatedAt: Date;
}