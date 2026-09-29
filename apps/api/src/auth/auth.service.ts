import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { AuthResponse, AuthTokens, JwtPayload, UserProfile } from '@privity/types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const normalizedUsername = dto.username.toLowerCase().trim();
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check unique username
    const existingUsername = await this.prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
    });
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    // Check unique email
    const existingEmail = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        displayName: dto.displayName.trim(),
        phone: dto.phone,
        privacySetting: 'public',
        role: 'user',
        isVerified: false,
      },
    });

    const tokens = await this.generateTokens(user.id, user.username, user.role);

    return {
      tokens,
      user: this.mapUserToProfile(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const loginQuery = dto.login.toLowerCase().trim();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: loginQuery, mode: 'insensitive' } },
          { username: { equals: loginQuery, mode: 'insensitive' } },
        ],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Your account has been permanently suspended.');
    }

    if (user.isSuspended && user.suspendedUntil && user.suspendedUntil > new Date()) {
      throw new UnauthorizedException(
        `Your account is temporarily suspended until ${user.suspendedUntil.toISOString()}`,
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.username, user.role);

    return {
      tokens,
      user: this.mapUserToProfile(user),
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'privity_super_secret_jwt_refresh_token_key_change_in_prod',
        ),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.isBanned) {
        throw new UnauthorizedException('User not found or suspended');
      }

      return this.generateTokens(user.id, user.username, user.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token required');
    }
    // Simulation / token decoder for MVP
    return { success: true, message: 'Email successfully verified' };
  }

  async sendOtp(phoneOrEmail: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: `OTP sent to ${phoneOrEmail}` };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  private async generateTokens(
    userId: string,
    username: string,
    role: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      username,
      role: role as any,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>(
        'JWT_SECRET',
        'privity_super_secret_jwt_access_token_key_change_in_prod',
      ),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'privity_super_secret_jwt_refresh_token_key_change_in_prod',
      ),
      expiresIn: '30d',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  private mapUserToProfile(user: any): UserProfile {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone || undefined,
      bio: user.bio || undefined,
      avatarUrl: user.avatarUrl || undefined,
      privacySetting: user.privacySetting,
      role: user.role,
      isVerified: user.isVerified,
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
