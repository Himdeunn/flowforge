import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RunsService } from './runs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get('health-summary')
  @ApiOperation({ summary: 'Get aggregated health metrics for last 24 hours' })
  @ApiResponse({
    status: 200,
    description: 'Returns activeRuns, successRate (0–1), avgDurationMs, and totalRuns',
  })
  async getHealthSummary() {
    return this.runsService.getHealthSummary();
  }

  @Get()
  @ApiOperation({ summary: 'List all workflow execution runs in tenant (cursor-paginated)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by run status: queued|running|completed|failed|timed_out' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor for pagination (run ID)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated list with { data, nextCursor }' })
  async findAll(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.runsService.findAll(status, cursor, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a workflow run including step run statuses' })
  @ApiResponse({ status: 200, description: 'Run details with stepRuns array' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.runsService.findOne(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get execution logs for a workflow run from MongoDB log store' })
  @ApiResponse({ status: 200, description: 'Array of log entries with timestamp, stepKey, level, message' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async getLogs(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.runsService.getLogs(id);
  }
}
