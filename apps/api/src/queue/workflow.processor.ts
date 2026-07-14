import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ExecutionEngine } from '../execution/execution-engine';

@Injectable()
export class WorkflowProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowProcessor.name);
  private worker: Worker;
  private redisConnection: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly executionEngine: ExecutionEngine,
  ) {}

  onModuleInit() {
    // Only start processor if explicitly enabled (or in dev/test where both API and Worker can run together)
    // We can default to enabling it so it runs out-of-the-box in all modes unless explicitly disabled
    const disableWorker = this.configService.get<string>('DISABLE_WORKER') === 'true';
    if (disableWorker) {
      this.logger.log('BullMQ Worker processor is disabled on this instance.');
      return;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      'workflow-exec',
      async (job: Job) => {
        const { runId, tenantId } = job.data;
        this.logger.log(`Processing workflow run job: ${runId} for tenant: ${tenantId}`);
        
        try {
          await this.executionEngine.executeWorkflow(runId);
        } catch (err) {
          this.logger.error(`Error executing workflow run "${runId}": ${err.message}`);
          throw err;
        }
      },
      {
        connection: this.redisConnection,
        concurrency: 5, // Process up to 5 runs in parallel
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed with error: ${err.message}`);
    });

    this.logger.log('BullMQ Worker processor initialized and listening for jobs.');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
    }
  }
}
