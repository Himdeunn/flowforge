import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateWorkflowDto } from './dto/generate-workflow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-workflow')
  @Roles('admin', 'editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a draft workflow DAG JSON from natural language description' })
  @ApiResponse({ status: 200, description: 'Workflow DAG successfully generated' })
  @ApiResponse({ status: 422, description: 'AI failed to generate a valid DAG definition' })
  async generateWorkflow(@Body() dto: GenerateWorkflowDto) {
    return this.aiService.generateWorkflow(dto.prompt, dto.currentDefinition);
  }
}
