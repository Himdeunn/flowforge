import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('AuthModule (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let refreshToken: string;
  const rand = Math.floor(Math.random() * 1000000);
  const tenantSlug = `tenant-${rand}`;
  const email = `admin-${rand}@example.com`;
  const password = `Password123!`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register a new tenant and admin user successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        tenantName: 'E2E Test Tenant',
        tenantSlug,
        email,
        password,
      });

    expect(res.status).toBe(201);
    expect(res.body.tenant).toBeDefined();
    expect(res.body.tenant.slug).toBe(tenantSlug);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('admin');
  });

  it('should not allow registration of the same tenant slug', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        tenantName: 'Another Tenant',
        tenantSlug,
        email: `another-${rand}@example.com`,
        password,
      });

    expect(res.status).toBe(409);
  });

  it('should login successfully and return JWT tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
        tenantSlug,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('admin');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('should allow access to admin-only endpoint with valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('should deny access to editor-only endpoint for admin role', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/editor-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('should deny access to protected endpoint without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin-only');

    expect(res.status).toBe(401);
  });

  it('should refresh access token using refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('should logout and invalidate refresh token', async () => {
    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({
        refreshToken,
      });

    expect(logoutRes.status).toBe(200);

    // Refresh should fail after logout
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken,
      });

    expect(refreshRes.status).toBe(401);
  });
});
