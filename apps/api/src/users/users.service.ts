import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: any) {
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered for this tenant');
    }

    const passwordHash = await bcrypt.hash(dto.password || 'password123', 10);

    return this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: any) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: any = {};
    if (dto.role) {
      data.role = dto.role;
    }
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      data.email = dto.email;
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
