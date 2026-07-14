import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private workflowQueue: Queue;
  private redisConnection: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    this.workflowQueue = new Queue('workflow-exec', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async addWorkflowJob(runId: string, tenantId: string): Promise<void> {
    await this.workflowQueue.add(
      'execute',
      { runId, tenantId },
      { jobId: runId }, // Prevent duplicate executions for the same run
    );
  }

  async onModuleDestroy() {
    if (this.workflowQueue) {
      await this.workflowQueue.close();
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
    }
  }
}
