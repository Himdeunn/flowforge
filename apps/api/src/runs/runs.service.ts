import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionLogService } from '../execution/services/execution-log.service';

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: ExecutionLogService,
  ) {}

  async findOne(id: string) {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id },
      include: {
        stepRuns: true,
        version: {
          select: {
            versionNumber: true,
            workflow: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`WorkflowRun with ID "${id}" not found.`);
    }

    return run;
  }

  async findAll(status?: any, cursor?: string, limit = 20) {
    const queryOptions: any = {
      where: {},
      include: {
        version: {
          select: {
            versionNumber: true,
            workflow: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    };

    if (status) {
      queryOptions.where.status = status;
    }

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    }

    const items = await this.prisma.workflowRun.findMany(queryOptions);
    const nextCursor = items.length === limit ? items[items.length - 1].id : null;

    return {
      data: items,
      nextCursor,
    };
  }

  async getLogs(runId: string) {
    // Verify run exists
    await this.findOne(runId);

    // Get logs from MongoDB
    return this.logService.getLogsForRun(runId);
  }

  async getHealthSummary() {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Count active (running/queued) runs
    const activeRuns = await this.prisma.workflowRun.count({
      where: {
        status: { in: ['running', 'queued'] as any },
      },
    });

    // Runs in last 24 hours
    const recentRuns = await this.prisma.workflowRun.findMany({
      where: {
        createdAt: { gte: since24h },
        status: { in: ['completed', 'failed', 'timed_out'] as any },
      },
      select: {
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const totalRuns = recentRuns.length;
    const successRuns = recentRuns.filter((r) => r.status === 'completed').length;
    const successRate = totalRuns > 0 ? successRuns / totalRuns : 1;

    // Average duration of completed runs
    const completedWithDuration = recentRuns.filter(
      (r) => r.status === 'completed' && r.startedAt && r.completedAt,
    );
    const avgDurationMs =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce((sum, r) => {
            const dur = new Date(r.completedAt!).getTime() - new Date(r.startedAt!).getTime();
            return sum + dur;
          }, 0) / completedWithDuration.length
        : 0;

    return {
      activeRuns,
      successRate: Math.round(successRate * 1000) / 1000,
      avgDurationMs: Math.round(avgDurationMs),
      totalRuns,
    };
  }
}
