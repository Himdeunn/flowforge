import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
} {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port, 10) || 6379,
      ...(parsed.password ? { password: parsed.password } : {}),
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private workflowQueue: Queue;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const connection = parseRedisUrl(redisUrl);

    this.workflowQueue = new Queue('workflow-exec', {
      connection: {
        ...connection,
        maxRetriesPerRequest: null,
      },
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
  }
}
