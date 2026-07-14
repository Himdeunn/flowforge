import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TenantMiddleware } from './auth/middleware/tenant.middleware';
import { AuthModule } from './auth/auth.module';
import { WebSocketModule } from './websocket/websocket.module';
import { ExecutionModule } from './execution/execution.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { QueueModule } from './queue/queue.module';
import { RunsModule } from './runs/runs.module';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiterGuard } from './common/guards/rate-limiter.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://127.0.0.1:27017/flowforge_logs',
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    WebSocketModule,
    ExecutionModule,
    WorkflowsModule,
    QueueModule,
    RunsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
