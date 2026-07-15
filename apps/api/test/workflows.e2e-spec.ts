import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('WorkflowsModule (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  const rand = Math.floor(Math.random() * 1000000);
  const tenantSlug = `tenant-wf-${rand}`;
  const email = `admin-wf-${rand}@example.com`;
  const password = `Password123!`;

  let workflowId: string;
  let firstVersionId: string;
  let secondVersionId: string;

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

    // Register & Login to get token
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      tenantName: 'WF Test Tenant',
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

  it('should create a new workflow definition with version 1', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'My Test Workflow',
        description: 'Test Description',
        definitionJson: {
          nodes: [{ id: 'node1', type: 'delay', config: { durationMs: 1000 } }],
          edges: [],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('My Test Workflow');
    expect(res.body.currentVersionId).toBeDefined();
    expect(res.body.currentVersion.versionNumber).toBe(1);

    workflowId = res.body.id;
    firstVersionId = res.body.currentVersionId;
  });

  it('should update workflow definition and create a new version', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'My Updated Test Workflow',
        definitionJson: {
          nodes: [
            { id: 'node1', type: 'delay', config: { durationMs: 2000 } },
            {
              id: 'node2',
              type: 'script',
              config: { script: 'output.result = true;' },
            },
          ],
          edges: [{ from: 'node1', to: 'node2' }],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('My Updated Test Workflow');
    expect(res.body.currentVersionId).toBeDefined();
    expect(res.body.currentVersionId).not.toBe(firstVersionId);
    expect(res.body.currentVersion.versionNumber).toBe(2);

    secondVersionId = res.body.currentVersionId;
  });

  it('should retrieve all versions of the workflow', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflowId}/versions`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].versionNumber).toBe(2);
    expect(res.body[1].versionNumber).toBe(1);
  });

  it('should rollback to version 1 and update currentVersionId', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/workflows/${workflowId}/versions/${firstVersionId}/rollback`,
      )
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.currentVersionId).toBe(firstVersionId);
    expect(res.body.currentVersion.versionNumber).toBe(1);
  });

  it('should soft delete workflow definition', async () => {
    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteRes.status).toBe(200);

    // Get workflow should now return 404 (NotFoundException)
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(404);
  });
});
