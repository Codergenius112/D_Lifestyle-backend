import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsPositive,
} from 'class-validator';
import { UserRole, BusinessScope } from '../enums';

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

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsArray()
  businessScopes?: BusinessScope[];
}

export class UpdateStaffRoleDto {
  @IsEnum(UserRole)
  role: UserRole;

  // ← NEW (multi-tenancy) — which of the staff member's assignments this
  // role change applies to. Required when the staff member has more than
  // one active business assignment; optional (defaults to their sole
  // assignment) otherwise. See AdminService.updateStaffRole for the
  // per-business-role caveat re: route-level guard enforcement.
  @IsOptional()
  @IsString()
  businessId?: string;
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