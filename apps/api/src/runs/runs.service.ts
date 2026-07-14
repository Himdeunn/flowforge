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

    return this.prisma.workflowRun.findMany(queryOptions);
  }

  async getLogs(runId: string) {
    // Verify run exists
    await this.findOne(runId);

    // Get logs from MongoDB
    return this.logService.getLogsForRun(runId);
  }
}
