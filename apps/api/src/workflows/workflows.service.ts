import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { parseAndValidateDag } from '../execution/dag-parser';
import { QueueService } from '../queue/queue.service';
import * as crypto from 'crypto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async create(dto: CreateWorkflowDto, userId: string) {
    // 1. Validate DAG
    try {
      parseAndValidateDag(dto.definitionJson);
    } catch (err) {
      throw new BadRequestException(`Invalid DAG: ${err.message}`);
    }

    const tenantId = PrismaService.tenantStorage.getStore();
    if (!tenantId) {
      throw new BadRequestException('Tenant context is missing');
    }

    // 2. Generate random 32-byte webhook token (64 hex characters)
    const webhookToken = crypto.randomBytes(32).toString('hex');

    // 3. Create Definition and Version in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Create definition first
      const definition = await tx.workflowDefinition.create({
        data: {
          name: dto.name,
          description: dto.description,
          cronExpression: dto.cronExpression,
          webhookToken,
          createdBy: userId,
          tenantId,
          isActive: true,
        },
      });

      // Create version 1
      const version = await tx.workflowVersion.create({
        data: {
          workflowId: definition.id,
          versionNumber: 1,
          definitionJson: dto.definitionJson,
          createdBy: userId,
        },
      });

      // Link definition to version 1
      const updatedDefinition = await tx.workflowDefinition.update({
        where: { id: definition.id },
        data: {
          currentVersionId: version.id,
        },
        include: {
          currentVersion: true,
        },
      });

      return updatedDefinition;
    });
  }

  async findAll(status?: string, cursor?: string, limit = 20) {
    // Basic query options
    const queryOptions: any = {
      where: {
        isActive: true,
      },
      include: {
        currentVersion: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: limit,
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Skip the cursor itself
    }

    // Filter by active status
    if (status !== undefined) {
      const isFilterActive = status === 'active';
      queryOptions.where.isActive = isFilterActive;
    }

    return this.prisma.workflowDefinition.findMany(queryOptions);
  }

  async findOne(id: string) {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        currentVersion: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID "${id}" not found.`);
    }

    return workflow;
  }

  async update(id: string, dto: UpdateWorkflowDto, userId: string) {
    const workflow = await this.findOne(id);

    if (dto.definitionJson) {
      // 1. Validate DAG
      try {
        parseAndValidateDag(dto.definitionJson);
      } catch (err) {
        throw new BadRequestException(`Invalid DAG: ${err.message}`);
      }

      // 2. Create new version
      return this.prisma.$transaction(async (tx) => {
        // Find highest version number
        const versions = await tx.workflowVersion.findMany({
          where: { workflowId: id },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        });

        const nextVersionNumber = (versions[0]?.versionNumber || 0) + 1;

        // Create the new version
        const newVersion = await tx.workflowVersion.create({
          data: {
            workflowId: id,
            versionNumber: nextVersionNumber,
            definitionJson: dto.definitionJson as any,
            createdBy: userId,
          },
        });

        // Update definition and currentVersionId reference
        return tx.workflowDefinition.update({
          where: { id },
          data: {
            name: dto.name ?? workflow.name,
            description: dto.description ?? workflow.description,
            cronExpression: dto.cronExpression ?? workflow.cronExpression,
            currentVersionId: newVersion.id,
          },
          include: {
            currentVersion: true,
          },
        });
      });
    }

    // Update fields without version bump if definitionJson is not modified
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: dto.name ?? workflow.name,
        description: dto.description ?? workflow.description,
        cronExpression: dto.cronExpression ?? workflow.cronExpression,
      },
      include: {
        currentVersion: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Soft delete
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  async getVersions(id: string) {
    await this.findOne(id);

    return this.prisma.workflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async rollback(id: string, versionId: string, userId: string) {
    const workflow = await this.findOne(id);

    // Verify the version belongs to this workflow
    const version = await this.prisma.workflowVersion.findFirst({
      where: {
        id: versionId,
        workflowId: id,
      },
    });

    if (!version) {
      throw new NotFoundException(
        `Workflow version with ID "${versionId}" not found for this workflow.`,
      );
    }

    // Perform rollback by updating currentVersionId
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        currentVersionId: versionId,
      },
      include: {
        currentVersion: true,
      },
    });
  }

  async triggerManual(id: string, userId: string) {
    const workflow = await this.findOne(id);
    if (!workflow.currentVersionId) {
      throw new BadRequestException('Workflow has no active version to run.');
    }

    const tenantId = PrismaService.tenantStorage.getStore();
    if (!tenantId) {
      throw new BadRequestException('Tenant context is missing');
    }

    // Create the run
    const run = await this.prisma.workflowRun.create({
      data: {
        tenantId,
        workflowId: id,
        versionId: workflow.currentVersionId,
        triggerType: 'manual',
        status: 'queued',
      },
    });

    // Queue the execution job
    await this.queueService.addWorkflowJob(run.id, tenantId);

    return run;
  }

  async triggerWebhook(webhookToken: string) {
    // Find workflow globally (webhook trigger is public, bypassing tenant scope)
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: {
        webhookToken,
        isActive: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Invalid webhook token.');
    }

    if (!workflow.currentVersionId) {
      throw new BadRequestException('Workflow has no active version to run.');
    }

    // Create the run under the workflow's tenant
    const run = await this.prisma.workflowRun.create({
      data: {
        tenantId: workflow.tenantId,
        workflowId: workflow.id,
        versionId: workflow.currentVersionId,
        triggerType: 'webhook',
        status: 'queued',
      },
    });

    // Queue the execution job
    await this.queueService.addWorkflowJob(run.id, workflow.tenantId);

    return run;
  }
}
