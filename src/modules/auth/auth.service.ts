import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../shared/entities/user.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { RegisterDto, LoginDto, AuthResponseDto } from '../../shared/dtos/auth.dto';
import { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,

    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  // ================= REGISTER =================
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.dataSource.transaction(async manager => {
      const existingUser = await manager.findOne(User, {
        where: { email: registerDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('Email already registered');
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, 12);

      const user = manager.create(User, {
        email: registerDto.email,
        passwordHash: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
      });

      const savedUser = await manager.save(user);

      const wallet = manager.create(Wallet, {
        userId: savedUser.id,
        balance: 0,
      });

      await manager.save(wallet);

      return this.generateAuthResponse(savedUser);
    });
  }

  // ================= LOGIN =================
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    // prevent timing attacks
    const fakeHash =
      '$2a$12$KbQiP7o9z4G5b6u8e8w3UOeV0tYz9Wj8eQJmZx9y7Q6cWf8y2xB6K';

    const passwordHash = user?.passwordHash || fakeHash;

    const passwordMatch = await bcrypt.compare(loginDto.password, passwordHash);

    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.generateAuthResponse(user);
  }

  // ================= REFRESH =================
  async refreshToken(token: string): Promise<AuthResponseDto> {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({
        where: { id: decoded.sub },
      });

      if (!user) throw new UnauthorizedException();

      return this.generateAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ================= TOKEN CREATION =================
  private generateAuthResponse(user: User): AuthResponseDto {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.JWT_EXPIRATION || '3600s') as StringValue,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '604800s') as StringValue,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // used by JwtStrategy
  async validateUser(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
