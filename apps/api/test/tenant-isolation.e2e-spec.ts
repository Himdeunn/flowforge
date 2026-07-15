import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication<App>;

  // Tenant A Credentials
  const randA = Math.floor(Math.random() * 1000000);
  const tenantSlugA = `tenant-a-${randA}`;
  const emailA = `admin-a-${randA}@example.com`;
  const passwordA = `Password123!`;
  let tokenA: string;

  // Tenant B Credentials
  const randB = Math.floor(Math.random() * 1000000);
  const tenantSlugB = `tenant-b-${randB}`;
  const emailB = `admin-b-${randB}@example.com`;
  const passwordB = `Password123!`;
  let tokenB: string;

  let workflowIdA: string;

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

    // Register & Login Tenant A
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      tenantName: 'Tenant A',
      tenantSlug: tenantSlugA,
      email: emailA,
      password: passwordA,
    });

    const loginResA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: emailA,
        password: passwordA,
        tenantSlug: tenantSlugA,
      });
    tokenA = loginResA.body.accessToken;

    // Register & Login Tenant B
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      tenantName: 'Tenant B',
      tenantSlug: tenantSlugB,
      email: emailB,
      password: passwordB,
    });

    const loginResB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: emailB,
        password: passwordB,
        tenantSlug: tenantSlugB,
      });
    tokenB = loginResB.body.accessToken;

    // Tenant A creates a workflow
    const wfRes = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Tenant A Workflow',
        description: 'Private workflow of Tenant A',
        definitionJson: {
          nodes: [{ id: 'node1', type: 'delay', config: { durationMs: 100 } }],
          edges: [],
        },
      });

    workflowIdA = wfRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow Tenant A to access its own workflow', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflowIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Tenant A Workflow');
  });

  it('should block Tenant B from reading Tenant A workflow (return 404)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflowIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('should block Tenant B from updating Tenant A workflow (return 404)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/workflows/${workflowIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Hacked name',
      });

    expect(res.status).toBe(404);
  });

  it('should block Tenant B from triggering Tenant A workflow (return 404)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowIdA}/trigger`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('should block Tenant B from deleting Tenant A workflow (return 404)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/workflows/${workflowIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});
