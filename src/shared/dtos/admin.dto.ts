import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsPositive,
} from 'class-validator';
import { UserRole } from '../enums';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  venueId: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsNumber()
  @IsPositive()
  capacity: number;

  @IsOptional()
  @IsArray()
  djs?: string[];

  @IsOptional()
  @IsString()
  genre?: string;
}

export class CreateVenueDto {
  @IsString()
  name: string;

  @IsString()
  location: string;

  @IsString()
  description: string;

  @IsNumber()
  @IsPositive()
  maxCapacity: number;

  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateMenuItemDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  image?: string;
}

export class AddStaffDto {
  @IsString()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateStaffRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  groupBy?: 'day' | 'week' | 'month';
}