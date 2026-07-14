import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set rate limit env variables BEFORE loading AppModule so that RateLimiterGuard picks them up!
process.env.RATE_LIMIT_MAX = '3';
process.env.RATE_LIMIT_WINDOW = '5';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Rate Limiting & Pagination (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  const rand = Math.floor(Math.random() * 1000000);
  const tenantSlug = `tenant-rp-${rand}`;
  const email = `admin-rp-${rand}@example.com`;
  const password = `Password123!`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Register & Login
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        tenantName: 'RateLimit Tenant',
        tenantSlug,
        email,
        password,
      });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
        tenantSlug,
      });

    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Rate Limiting', () => {
    it('should allow 3 requests but block the 4th request with 429, then recover after window expires', async () => {
      // 1. First 3 requests should pass (note: auth login/register don't count towards tenant limit if they are pre-token, but they might count against IP.
      // However, we set the token for subsequent requests, which will trigger the tenant-based limit).
      
      const req1 = await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(req1.status).toBe(200);

      const req2 = await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(req2.status).toBe(200);

      const req3 = await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(req3.status).toBe(200);

      // 4th request must return 429 Too Many Requests
      const req4 = await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(req4.status).toBe(429);

      // Wait for rate limit window of 5 seconds to expire
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // 5th request should succeed again
      const req5 = await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(req5.status).toBe(200);
    });
  });

  describe('Cursor Pagination', () => {
    it('should paginate results page-by-page using cursor', async () => {
      // Wait to ensure rate limit window is fully cleared for these requests
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Create 3 workflows
      const wfs = [];
      for (let i = 1; i <= 3; i++) {
        const wf = await request(app.getHttpServer())
          .post('/api/v1/workflows')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: `WF Paged ${i}`,
            definitionJson: {
              nodes: [{ id: 'step', type: 'delay', config: { durationMs: 100 } }],
              edges: [],
            },
          });
        expect(wf.status).toBe(201);
        wfs.push(wf.body);
      }

      // Wait 6 seconds for the rate limiter window to expire
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // 1. Fetch first page (limit = 1)
      const page1 = await request(app.getHttpServer())
        .get('/api/v1/workflows?limit=1')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(page1.status).toBe(200);
      expect(page1.body.length).toBe(1);
      const cursor1 = page1.body[0].id;
      const name1 = page1.body[0].name;

      // 2. Fetch second page (limit = 1, cursor = cursor1)
      const page2 = await request(app.getHttpServer())
        .get(`/api/v1/workflows?limit=1&cursor=${cursor1}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.length).toBe(1);
      const cursor2 = page2.body[0].id;
      const name2 = page2.body[0].name;

      expect(cursor2).not.toBe(cursor1);
      expect(name2).not.toBe(name1);

      // 3. Fetch third page (limit = 1, cursor = cursor2)
      const page3 = await request(app.getHttpServer())
        .get(`/api/v1/workflows?limit=1&cursor=${cursor2}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(page3.status).toBe(200);
      expect(page3.body.length).toBe(1);
      const cursor3 = page3.body[0].id;
      const name3 = page3.body[0].name;

      expect(cursor3).not.toBe(cursor1);
      expect(cursor3).not.toBe(cursor2);
      expect(name3).not.toBe(name1);
      expect(name3).not.toBe(name2);
    });
  });
});
