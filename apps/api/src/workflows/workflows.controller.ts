import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReqUser } from '../auth/decorators/req-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Create a new workflow definition and version 1' })
  @ApiResponse({ status: 201, description: 'Workflow successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data or cyclic DAG' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (Editor or Admin roles required)' })
  async create(@Body() createWorkflowDto: CreateWorkflowDto, @ReqUser() user: any) {
    return this.workflowsService.create(createWorkflowDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all workflow definitions in tenant (cursor-paginated)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by active status: active|inactive' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor ID for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
  @ApiResponse({ status: 200, description: 'List of workflow definitions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.workflowsService.findAll(status, cursor, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific workflow definition' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow definition' })
  @ApiResponse({ status: 200, description: 'Workflow definition details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow definition not found' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.workflowsService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Update workflow details and create a new version' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow definition' })
  @ApiResponse({ status: 200, description: 'Workflow successfully updated, new version created' })
  @ApiResponse({ status: 400, description: 'Invalid input data or cyclic DAG' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Workflow definition not found' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
    @ReqUser() user: any,
  ) {
    return this.workflowsService.update(id, updateWorkflowDto, user.id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Soft delete a workflow definition' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow definition' })
  @ApiResponse({ status: 200, description: 'Workflow successfully deactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (Admin role required)' })
  @ApiResponse({ status: 404, description: 'Workflow definition not found' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.workflowsService.remove(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all versions of a specific workflow' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow definition' })
  @ApiResponse({ status: 200, description: 'List of all versions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow definition not found' })
  async getVersions(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.workflowsService.getVersions(id);
  }

  @Post(':id/versions/:versionId/rollback')
  @Roles('admin', 'editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback workflow to a specific version number' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow definition' })
  @ApiParam({ name: 'versionId', description: 'UUID of the target workflow version' })
  @ApiResponse({ status: 200, description: 'Workflow successfully rolled back to version' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Workflow or version not found' })
  async rollback(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @ReqUser() user: any,
  ) {
    return this.workflowsService.rollback(id, versionId, user.id);
  }

  @Post(':id/trigger')
  @Roles('admin', 'editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a workflow run manually' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow definition' })
  @ApiResponse({ status: 200, description: 'Workflow successfully triggered, run queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async trigger(@Param('id', new ParseUUIDPipe()) id: string, @ReqUser() user: any) {
    return this.workflowsService.triggerManual(id, user.id);
  }
}
