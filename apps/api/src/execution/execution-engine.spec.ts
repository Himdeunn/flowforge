import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionEngine } from './execution-engine';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionLogService } from './services/execution-log.service';
import { StepExecutor } from './step-executor';
import { RunsGateway } from '../websocket/runs.gateway';

describe('ExecutionEngine', () => {
  let engine: ExecutionEngine;
  let prisma: PrismaService;
  let logService: ExecutionLogService;
  let stepExecutor: StepExecutor;
  let runsGateway: RunsGateway;

  const mockPrisma = {
    workflowRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    stepRun: {
      findFirst: jest.fn().mockResolvedValue({ id: 'step-run-id' }),
      create: jest.fn().mockResolvedValue({ id: 'step-run-id' }),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockLogService = {
    log: jest.fn().mockResolvedValue({}),
  };

  const mockRunsGateway = {
    emitToRunRoom: jest.fn(),
  };

  const mockStepExecutor = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionEngine,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExecutionLogService, useValue: mockLogService },
        { provide: StepExecutor, useValue: mockStepExecutor },
        { provide: RunsGateway, useValue: mockRunsGateway },
      ],
    }).compile();

    engine = module.get<ExecutionEngine>(ExecutionEngine);
    prisma = module.get<PrismaService>(PrismaService);
    logService = module.get<ExecutionLogService>(ExecutionLogService);
    stepExecutor = module.get<StepExecutor>(StepExecutor);
    runsGateway = module.get<RunsGateway>(RunsGateway);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should run a simple linear workflow successfully', async () => {
    // Arrange
    const runId = 'run-1';
    const tenantId = 'tenant-1';
    const definitionJson = {
      nodes: [
        { id: 'step1', type: 'delay', config: { durationMs: 100 } },
        { id: 'step2', type: 'script', config: { script: 'output.result = 1;' } },
      ],
      edges: [{ from: 'step1', to: 'step2' }],
    };

    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      id: runId,
      tenantId,
      workflowId: 'workflow-1',
      version: {
        definitionJson,
        workflow: { cronExpression: null },
      },
    });

    mockStepExecutor.execute.mockResolvedValueOnce({ completed: true });
    mockStepExecutor.execute.mockResolvedValueOnce({ result: 1 });

    // Act
    const promise = engine.executeWorkflow(runId);

    // Fast-forward delays inside execution engine and step executors
    await jest.runAllTimersAsync();
    await promise;

    // Assert
    expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: expect.any(Date),
      },
    });

    expect(mockPrisma.workflowRun.update).toHaveBeenLastCalledWith({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: expect.any(Date),
      },
    });

    expect(mockStepExecutor.execute).toHaveBeenCalledTimes(2);
    expect(runsGateway.emitToRunRoom).toHaveBeenCalledWith(runId, 'run:started', expect.any(Object));
    expect(runsGateway.emitToRunRoom).toHaveBeenCalledWith(runId, 'run:completed', expect.any(Object));
  });

  it('should retry a step upon failure and succeed if subsequent attempt passes', async () => {
    // Arrange
    const runId = 'run-2';
    const tenantId = 'tenant-1';
    const definitionJson = {
      nodes: [
        { id: 'step1', type: 'http', config: { url: 'http://test', maxRetries: 2, baseDelayMs: 100 } },
      ],
      edges: [],
    };

    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      id: runId,
      tenantId,
      workflowId: 'workflow-1',
      version: {
        definitionJson,
        workflow: { cronExpression: null },
      },
    });

    // 1st attempt fails, 2nd attempt succeeds
    mockStepExecutor.execute
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ status: 200 });

    // Act
    const promise = engine.executeWorkflow(runId);

    // Run pending timers (for the retry delay)
    await jest.runAllTimersAsync();
    await promise;

    // Assert
    expect(mockStepExecutor.execute).toHaveBeenCalledTimes(2);
    expect(mockPrisma.stepRun.update).toHaveBeenCalledWith({
      where: { id: 'step-run-id' },
      data: {
        status: 'running',
        attempt: 1,
        startedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.stepRun.update).toHaveBeenCalledWith({
      where: { id: 'step-run-id' },
      data: {
        status: 'running',
        attempt: 2,
        startedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.stepRun.update).toHaveBeenLastCalledWith({
      where: { id: 'step-run-id' },
      data: {
        status: 'success',
        completedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.workflowRun.update).toHaveBeenLastCalledWith({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: expect.any(Date),
      },
    });
  });

  it('should fail the workflow run if a step exhausts all retries', async () => {
    // Arrange
    const runId = 'run-3';
    const tenantId = 'tenant-1';
    const definitionJson = {
      nodes: [
        { id: 'step1', type: 'http', config: { url: 'http://test', maxRetries: 1, baseDelayMs: 100 } },
      ],
      edges: [],
    };

    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      id: runId,
      tenantId,
      workflowId: 'workflow-1',
      version: {
        definitionJson,
        workflow: { cronExpression: null },
      },
    });

    // Both attempts fail
    mockStepExecutor.execute.mockRejectedValue(new Error('Fatal Error'));

    // Act
    const promise = engine.executeWorkflow(runId);
    await jest.runAllTimersAsync();
    await promise;

    // Assert
    expect(mockStepExecutor.execute).toHaveBeenCalledTimes(2); // attempt 1 + retry 1
    expect(mockPrisma.stepRun.update).toHaveBeenLastCalledWith({
      where: { id: 'step-run-id' },
      data: {
        status: 'failed',
        completedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.workflowRun.update).toHaveBeenLastCalledWith({
      where: { id: runId },
      data: {
        status: 'failed',
        completedAt: expect.any(Date),
      },
    });
  });

  it('should abort and mark workflow as timed_out if execution exceeds timeout limit', async () => {
    // Arrange
    const runId = 'run-4';
    const tenantId = 'tenant-1';
    const definitionJson = {
      nodes: [
        { id: 'step1', type: 'delay', config: { durationMs: 20 * 60 * 1000 } }, // 20 minutes (exceeds 15m default timeout)
      ],
      edges: [],
    };

    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      id: runId,
      tenantId,
      workflowId: 'workflow-1',
      version: {
        definitionJson,
        workflow: { cronExpression: null },
      },
    });

    // Step executor execution will hang (simulated by not resolving immediately)
    let resolveStep: any;
    const stepPromise = new Promise((resolve) => {
      resolveStep = resolve;
    });
    mockStepExecutor.execute.mockReturnValue(stepPromise);

    // Act
    const executePromise = engine.executeWorkflow(runId);

    // Advance Jest clock by 16 minutes (triggers the 15-minute global timeout)
    await jest.advanceTimersByTimeAsync(16 * 60 * 1000);
    await executePromise;

    // Assert
    expect(mockPrisma.workflowRun.update).toHaveBeenLastCalledWith({
      where: { id: runId },
      data: {
        status: 'timed_out',
        completedAt: expect.any(Date),
      },
    });

    expect(mockPrisma.stepRun.updateMany).toHaveBeenCalledWith({
      where: {
        runId,
        status: { in: ['pending', 'running'] },
      },
      data: {
        status: 'timed_out',
        completedAt: expect.any(Date),
      },
    });

    // Clean up unresolved step promise
    resolveStep();
  });
});
