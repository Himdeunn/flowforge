import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly maxRequests: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.maxRequests = parseInt(
      this.configService.get<string>('RATE_LIMIT_MAX') || '100',
      10,
    );
    this.windowSeconds = parseInt(
      this.configService.get<string>('RATE_LIMIT_WINDOW') || '60',
      10,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const path = request.path || '';
    if (
      path.includes('/auth/register') ||
      path.includes('/auth/login') ||
      path.includes('/auth/refresh')
    ) {
      return true;
    }

    // Check if route is public
    // You can bypass rate limit on specific paths if necessary, but applying it globally is safer
    const tenantId = request.tenantId;
    const ip = request.ip || request.connection.remoteAddress;

    // Use tenantId if available, fallback to IP
    const key = tenantId
      ? `rate_limit:tenant:${tenantId}`
      : `rate_limit:ip:${ip}`;

    const current = await this.redisService.incr(key);
    if (current === 1) {
      await this.redisService.expire(key, this.windowSeconds);
    }

    if (current > this.maxRequests) {
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
