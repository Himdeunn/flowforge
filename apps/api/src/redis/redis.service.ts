import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const redisUrl =
      configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    super(redisUrl);
  }

  onModuleInit() {
    // Already connected via super
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
