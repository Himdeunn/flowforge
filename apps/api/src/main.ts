import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS — whitelist frontend origin
  app.enableCors({
    origin: process.env.WEB_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Tenant-ID',
      'X-Request-ID',
    ],
    credentials: true,
  });

  // Global validation pipe — reject unknown fields
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FlowForge API')
    .setDescription(
      'Real-Time Multi-Tenant Workflow Orchestration Engine\n\n' +
        '**Auth:** Use POST /auth/login to obtain a Bearer token, then click "Authorize" and paste it.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication & token management')
    .addTag('Workflows', 'Workflow definitions, versioning & triggers')
    .addTag('Runs', 'Workflow run history, logs & health summary')
    .addTag('AI', 'Natural Language Workflow Builder (Gemini-powered)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 FlowForge API running at http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
