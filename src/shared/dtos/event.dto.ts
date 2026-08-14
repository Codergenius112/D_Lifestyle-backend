import {
  IsString, IsNotEmpty, IsOptional, IsDateString,
  IsInt, Min, IsArray, IsNumber, IsEnum, ArrayMaxSize, ArrayMinSize,
} from 'class-validator';
import { CommissionPayer } from '../enums';

export class CreateEventDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  venueId?: string;

  @IsDateString({}, { message: 'startDate must be a valid date' })
  startDate: string;

  @IsDateString({}, { message: 'endDate must be a valid date' })
  endDate: string;

  @IsOptional() @IsInt() @Min(0)
  capacity?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true })
  djs?: string[];

  @IsOptional() @IsString()
  genre?: string;

  @IsOptional() @IsString()
  dresscode?: string;

  @IsOptional() @IsNumber() @Min(0)
  ticketPrice?: number;

  @IsArray() @ArrayMinSize(1, { message: 'At least one image is required' }) @IsString({ each: true })
  images: string[];

  @IsOptional() @IsEnum(CommissionPayer)
  commissionPayer?: CommissionPayer;
}

export class UpdateEventDto {
  @IsOptional() @IsString() @IsNotEmpty()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  venueId?: string;

  @IsOptional() @IsDateString({}, { message: 'startDate must be a valid date' })
  startDate?: string;

  @IsOptional() @IsDateString({}, { message: 'endDate must be a valid date' })
  endDate?: string;

  @IsOptional() @IsInt() @Min(0)
  capacity?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true })
  djs?: string[];

  @IsOptional() @IsString()
  genre?: string;

  @IsOptional() @IsString()
  dresscode?: string;

  @IsOptional() @IsNumber() @Min(0)
  ticketPrice?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsEnum(CommissionPayer)
  commissionPayer?: CommissionPayer;

  @IsOptional() @IsString()
  status?: string;
}
