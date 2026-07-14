import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionLogService } from './services/execution-log.service';
import { StepExecutor } from './step-executor';
import { RunsGateway } from '../websocket/runs.gateway';
import { parseAndValidateDag } from './dag-parser';
import { getExecutionLayers } from './topological-sort';

@Injectable()
export class ExecutionEngine {
  private readonly logger = new Logger(ExecutionEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: ExecutionLogService,
    private readonly stepExecutor: StepExecutor,
    private readonly runsGateway: RunsGateway,
  ) {}

  async executeWorkflow(runId: string): Promise<void> {
    // 1. Fetch WorkflowRun details
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        version: {
          include: {
            workflow: true,
          },
        },
      },
    });

    if (!run) {
      this.logger.error(`WorkflowRun with ID "${runId}" not found.`);
      return;
    }

    const tenantId = run.tenantId;
    const definitionJson = run.version.definitionJson as any;

    // 2. Parse and Validate DAG
    let parsedDag: { nodes: any[]; edges: any[] };
    try {
      parsedDag = parseAndValidateDag(definitionJson);
    } catch (err) {
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      });
      await this.logService.log(
        tenantId,
        runId,
        'system',
        1,
        'error',
        `DAG Parsing failed: ${err.message}`,
      );
      this.runsGateway.emitToRunRoom(runId, 'run:completed', {
        runId,
        status: 'failed',
        completedAt: new Date(),
      });
      return;
    }

    // 3. Topological Sort into execution layers
    const layers = getExecutionLayers(parsedDag);

    // 4. Update status to running
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    this.runsGateway.emitToRunRoom(runId, 'run:started', {
      runId,
      workflowId: run.workflowId,
      startedAt: new Date(),
    });

    await this.logService.log(
      tenantId,
      runId,
      'system',
      1,
      'info',
      `Workflow run started. Calculated ${layers.length} layers for execution.`,
    );

    // Initialize all step runs in Postgres as pending
    for (const node of parsedDag.nodes) {
      const stepRun = await this.prisma.stepRun.findFirst({
        where: { runId, stepKey: node.id },
      });
      if (stepRun) {
        await this.prisma.stepRun.update({
          where: { id: stepRun.id },
          data: {
            status: 'pending',
            attempt: 0,
          },
        });
      } else {
        await this.prisma.stepRun.create({
          data: {
            runId,
            stepKey: node.id,
            status: 'pending',
            attempt: 0,
          },
        });
      }
    }

    // Context to store results of completed steps (for references in variables)
    const context = {
      steps: {} as Record<string, { status: string; output: any }>,
    };

    // Tracking for skipped and failed states
    const skippedNodes = new Set<string>();
    let runStatus: 'completed' | 'failed' | 'timed_out' = 'completed';
    let isTimeoutTriggered = false;

    let timeoutReject: (err: Error) => void;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutReject = reject;
    });

    // Set up global timeout
    const timeoutMinutes = run.version.workflow.cronExpression ? 15 : 15; // default 15 mins
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const timeoutTimer = setTimeout(async () => {
      isTimeoutTriggered = true;
      runStatus = 'timed_out';

      this.logger.warn(`Workflow run "${runId}" timed out after ${timeoutMinutes} minutes.`);

      try {
        // Mark all non-finished step runs as timed_out
        await this.prisma.stepRun.updateMany({
          where: {
            runId,
            status: { in: ['pending', 'running'] },
          },
          data: {
            status: 'timed_out',
            completedAt: new Date(),
          },
        });

        await this.prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: 'timed_out',
            completedAt: new Date(),
          },
        });

        await this.logService.log(
          tenantId,
          runId,
          'system',
          1,
          'error',
          `Workflow run timed out after ${timeoutMinutes} minutes.`,
        );

        this.runsGateway.emitToRunRoom(runId, 'run:completed', {
          runId,
          status: 'timed_out',
          completedAt: new Date(),
        });
      } catch (dbErr) {
        this.logger.error(`Failed to update timeout status in db: ${dbErr.message}`);
      }

      timeoutReject(new Error('TIMEOUT'));
    }, timeoutMs);

    const runExecution = async () => {
      // Execute layer by layer
      for (const layer of layers) {
        if (isTimeoutTriggered || runStatus === 'failed') {
          break;
        }

        // Execute all steps in the current layer in parallel
        await Promise.all(
          layer.map(async (stepId) => {
            if (isTimeoutTriggered || runStatus === 'failed') {
              // Mark step as skipped if previous step caused run failure
              skippedNodes.add(stepId);
              await this.updateStepStatus(runId, stepId, 'skipped');
              return;
            }

            const node = parsedDag.nodes.find((n) => n.id === stepId);
            
            // Check dependencies to see if we should skip this step
            const incomingEdges = parsedDag.edges.filter((e) => e.to === stepId);
            let shouldSkip = false;

            for (const edge of incomingEdges) {
              const parentId = edge.from;
              const parentResult = context.steps[parentId];

              // If parent failed or was skipped, the child must be skipped
              if (!parentResult || parentResult.status === 'failed' || parentResult.status === 'skipped') {
                shouldSkip = true;
                break;
              }

              // If parent is a condition node, verify if the condition matches the edge
              const parentNode = parsedDag.nodes.find((n) => n.id === parentId);
              if (parentNode.type === 'condition') {
                const conditionResult = parentResult.output?.result;
                
                // Determine expected condition value from edge (e.g. edge.condition = false)
                // Default is true if not specified
                const expectedValue = edge.conditionValue !== undefined ? edge.conditionValue : true;
                
                if (conditionResult !== expectedValue) {
                  shouldSkip = true;
                  break;
                }
              }
            }

            if (shouldSkip || skippedNodes.has(stepId)) {
              skippedNodes.add(stepId);
              context.steps[stepId] = { status: 'skipped', output: null };
              await this.updateStepStatus(runId, stepId, 'skipped');
              await this.logService.log(
                tenantId,
                runId,
                stepId,
                0,
                'info',
                `Step skipped because dependencies did not match execution criteria.`,
              );
              return;
            }

            // Run step with retries
            try {
              const result = await this.executeStepWithRetry(
                runId,
                tenantId,
                node,
                context,
              );
              context.steps[stepId] = { status: 'success', output: result };
            } catch (err) {
              context.steps[stepId] = { status: 'failed', output: { error: err.message } };
              runStatus = 'failed';
            }
          }),
        );
      }
    };

    try {
      await Promise.race([
        runExecution(),
        timeoutPromise,
      ]);
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        return;
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }

    if (isTimeoutTriggered) {
      return;
    }

    // Update workflow run final status
    const finalStatus = runStatus;
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
      },
    });

    await this.logService.log(
      tenantId,
      runId,
      'system',
      1,
      finalStatus === 'completed' ? 'info' : 'error',
      `Workflow run finished with status: ${finalStatus}.`,
    );

    this.runsGateway.emitToRunRoom(runId, 'run:completed', {
      runId,
      status: finalStatus,
      completedAt: new Date(),
    });
  }

  private async executeStepWithRetry(
    runId: string,
    tenantId: string,
    node: any,
    context: any,
  ): Promise<any> {
    const maxRetries = node.config?.maxRetries !== undefined ? node.config.maxRetries : 3;
    const baseDelayMs = node.config?.baseDelayMs !== undefined ? node.config.baseDelayMs : 1000;

    let attempt = 0;
    while (true) {
      attempt++;
      
      // Update step status in db
      await this.updateStepRunStatus(runId, node.id, {
        status: 'running',
        attempt,
        startedAt: new Date(),
      });

      this.runsGateway.emitToRunRoom(runId, 'step:status_changed', {
        runId,
        stepKey: node.id,
        status: 'running',
        attempt,
        timestamp: new Date(),
      });

      await this.logService.log(
        tenantId,
        runId,
        node.id,
        attempt,
        'info',
        `Step execution started (attempt ${attempt}/${maxRetries + 1}).`,
      );

      try {
        const output = await this.stepExecutor.execute(node, context);

        // Success
        await this.updateStepRunStatus(runId, node.id, {
          status: 'success',
          completedAt: new Date(),
        });

        this.runsGateway.emitToRunRoom(runId, 'step:status_changed', {
          runId,
          stepKey: node.id,
          status: 'success',
          attempt,
          timestamp: new Date(),
        });

        await this.logService.log(
          tenantId,
          runId,
          node.id,
          attempt,
          'info',
          `Step executed successfully.`,
          { output },
        );

        return output;
      } catch (err) {
        // Failed attempt
        await this.logService.log(
          tenantId,
          runId,
          node.id,
          attempt,
          'warn',
          `Step execution failed: ${err.message}`,
        );

        if (attempt <= maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await this.logService.log(
            tenantId,
            runId,
            node.id,
            attempt,
            'warn',
            `Retrying step in ${delay}ms...`,
          );
          
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // Exhausted retries
          await this.updateStepRunStatus(runId, node.id, {
            status: 'failed',
            completedAt: new Date(),
          });

          this.runsGateway.emitToRunRoom(runId, 'step:status_changed', {
            runId,
            stepKey: node.id,
            status: 'failed',
            attempt,
            timestamp: new Date(),
          });

          await this.logService.log(
            tenantId,
            runId,
            node.id,
            attempt,
            'error',
            `Step failed after ${attempt} attempts. Error: ${err.message}`,
          );

          throw err;
        }
      }
    }
  }

  private async updateStepStatus(runId: string, stepKey: string, status: StepStatus): Promise<void> {
    await this.updateStepRunStatus(runId, stepKey, {
      status,
      completedAt: new Date(),
    });

    this.runsGateway.emitToRunRoom(runId, 'step:status_changed', {
      runId,
      stepKey,
      status,
      attempt: 0,
      timestamp: new Date(),
    });
  }

  private async updateStepRunStatus(
    runId: string,
    stepKey: string,
    data: {
      status: StepStatus;
      attempt?: number;
      startedAt?: Date;
      completedAt?: Date;
    },
  ): Promise<void> {
    const stepRun = await this.prisma.stepRun.findFirst({
      where: { runId, stepKey },
    });
    if (stepRun) {
      await this.prisma.stepRun.update({
        where: { id: stepRun.id },
        data,
      });
    }
  }
}
