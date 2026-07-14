import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RunsService } from './runs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get()
  @ApiOperation({ summary: 'List all workflow execution runs in tenant' })
  async findAll(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.runsService.findAll(status, cursor, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a workflow run and its step statuses' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.runsService.findOne(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get execution logs for a workflow run from MongoDB' })
  async getLogs(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.runsService.getLogs(id);
  }
}
