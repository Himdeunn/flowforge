import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiry: string;
  private readonly refreshExpiry: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.get<string>('JWT_ACCESS_SECRET') || 'changeme-access-secret';
    this.refreshSecret = configService.get<string>('JWT_REFRESH_SECRET') || 'changeme-refresh-secret';
    this.accessExpiry = configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    this.refreshExpiry = configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

  async register(dto: RegisterDto) {
    // 1. Check if tenant slug already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (existingTenant) {
      throw new ConflictException('Tenant slug is already taken');
    }

    // 2. Check if user already exists globally (or within tenant)
    // To be safe, we check if this email is already registered under this tenant
    // Since tenant does not exist yet, we check if email is unique globally for new registration (or we can just create both inside transaction)
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create Tenant and Admin User in a transaction
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug: dto.tenantSlug,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: 'admin',
          tenantId: tenant.id,
        },
      });

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    });
  }

  async login(dto: LoginDto) {
    // 1. Find tenant by slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    // 2. Find user in this tenant by email
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: dto.email,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    // 4. Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiry,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiry,
      },
    );

    // 5. Store active refresh token in Redis (7 days TTL)
    const redisKey = `refresh_token:${user.id}:${refreshToken}`;
    await this.redis.set(redisKey, '1', 'EX', 7 * 24 * 60 * 60);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      // 1. Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshSecret,
      });

      const userId = payload.sub;

      // 2. Check if token exists in Redis
      const redisKey = `refresh_token:${userId}:${refreshToken}`;
      const exists = await this.redis.exists(redisKey);
      if (!exists) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // 3. Get user details to generate new access token
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 4. Generate new access token
      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiry,
      });

      return { accessToken };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      // 1. Verify token to get userId
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshSecret,
      });

      const userId = payload.sub;

      // 2. Delete key from Redis
      const redisKey = `refresh_token:${userId}:${refreshToken}`;
      await this.redis.del(redisKey);

      return { message: 'Logged out successfully' };
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
