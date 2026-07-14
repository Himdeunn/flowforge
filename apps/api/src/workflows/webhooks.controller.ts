import { Controller, Post, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post(':webhookToken/trigger')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a workflow run via public webhook' })
  @ApiResponse({ status: 200, description: 'Workflow successfully triggered and queued' })
  @ApiResponse({ status: 404, description: 'Invalid webhook token' })
  async triggerWebhook(@Param('webhookToken') webhookToken: string) {
    return this.workflowsService.triggerWebhook(webhookToken);
  }
}
