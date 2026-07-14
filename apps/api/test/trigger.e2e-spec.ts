import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Queue & Trigger Integration (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  const rand = Math.floor(Math.random() * 1000000);
  const tenantSlug = `tenant-tr-${rand}`;
  const email = `admin-tr-${rand}@example.com`;
  const password = `Password123!`;

  let workflowId: string;
  let webhookToken: string;

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
        tenantName: 'Trigger Tenant',
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

    // Create workflow
    const wfRes = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Trigger Demo WF',
        description: 'Demo',
        definitionJson: {
          nodes: [
            { id: 'nodeA', type: 'delay', config: { durationMs: 100 } },
          ],
          edges: [],
        },
      });

    if (wfRes.status !== 201) {
      console.error('WORKFLOW CREATION FAILED:', wfRes.status, wfRes.body || wfRes.text);
    }

    workflowId = wfRes.body.id;
    webhookToken = wfRes.body.webhookToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should trigger manual run and process it in background to completion', async () => {
    // 1. Trigger
    const triggerRes = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/trigger`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(triggerRes.status).toBe(200);
    expect(triggerRes.body.id).toBeDefined();
    expect(triggerRes.body.status).toBe('queued');

    const runId = triggerRes.body.id;

    // 2. Poll until completed
    let status = 'queued';
    const startTime = Date.now();
    
    while (status === 'queued' || status === 'running') {
      // Prevent infinite test loop
      if (Date.now() - startTime > 10000) {
        throw new Error('Test timed out waiting for run to complete');
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const runRes = await request(app.getHttpServer())
        .get(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(runRes.status).toBe(200);
      status = runRes.body.status;
    }

    expect(status).toBe('completed');

    // 3. Verify step run is success
    const runDetails = await request(app.getHttpServer())
      .get(`/api/v1/runs/${runId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(runDetails.body.stepRuns).toBeDefined();
    expect(runDetails.body.stepRuns.length).toBe(1);
    expect(runDetails.body.stepRuns[0].status).toBe('success');

    // 4. Verify MongoDB logs exist
    const logsRes = await request(app.getHttpServer())
      .get(`/api/v1/runs/${runId}/logs`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logsRes.status).toBe(200);
    expect(Array.isArray(logsRes.body)).toBe(true);
    expect(logsRes.body.length).toBeGreaterThan(0);
    expect(logsRes.body.some((log: any) => log.stepKey === 'nodeA')).toBe(true);
  });

  it('should trigger webhook run publically and process it in background', async () => {
    // 1. Trigger via public webhook endpoint
    const triggerRes = await request(app.getHttpServer())
      .post(`/api/v1/webhooks/${webhookToken}/trigger`)
      .send({ payload: 'hello-webhook' }); // Send some body

    expect(triggerRes.status).toBe(200);
    expect(triggerRes.body.id).toBeDefined();
    expect(triggerRes.body.status).toBe('queued');

    const runId = triggerRes.body.id;

    // 2. Poll until completed
    let status = 'queued';
    const startTime = Date.now();

    while (status === 'queued' || status === 'running') {
      if (Date.now() - startTime > 10000) {
        throw new Error('Test timed out waiting for webhook run to complete');
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const runRes = await request(app.getHttpServer())
        .get(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${accessToken}`); // verify via auth token

      expect(runRes.status).toBe(200);
      status = runRes.body.status;
    }

    expect(status).toBe('completed');
  });
});
