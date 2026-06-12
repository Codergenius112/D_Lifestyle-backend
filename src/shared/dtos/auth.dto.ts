import { IsEmail, IsString, MinLength, IsOptional, IsPhoneNumber, IsEnum, IsArray } from 'class-validator';
import { UserRole, BusinessScope } from '../enums';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    businessScopes: BusinessScope[] | null;
    isActive: boolean;
  };
}

export class AdminRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserRole)
  role: UserRole.ADMIN | UserRole.MANAGER;

  @IsOptional()
  @IsArray()
  businessScopes?: BusinessScope[];
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}