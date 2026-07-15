import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';

describe('AiService', () => {
  let service: AiService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'GEMINI_API_KEY') return undefined;
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a mock DAG when NODE_ENV is test', async () => {
    const result = await service.generateWorkflow(
      'create a workflow that sends an HTTP request',
    );
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
  });

  it('should return a valid DAG structure with node ids', async () => {
    const result = await service.generateWorkflow('simple test workflow');
    for (const node of result.nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('config');
    }
  });

  it('should augment existing definition when currentDefinition is provided', async () => {
    const current = {
      nodes: [
        {
          id: 'fetch',
          type: 'http',
          config: { url: 'http://test.com', method: 'GET' },
        },
      ],
      edges: [],
    };
    const result = await service.generateWorkflow(
      'add a delay step after fetch',
      current,
    );
    expect(result.nodes.length).toBeGreaterThan(1);
  });

  it('should truncate prompt longer than 2000 characters', async () => {
    const longPrompt = 'a'.repeat(3000);
    // Should not throw, truncation occurs internally
    const result = await service.generateWorkflow(longPrompt);
    expect(result).toHaveProperty('nodes');
  });
});
