import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get root hello message' })
  @ApiResponse({ status: 200, description: 'Hello message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get API health status' })
  @ApiResponse({ status: 200, description: 'API health status ok' })
  getHealth() {
    return { status: 'ok' };
  }

  @Get('admin-only')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get secure admin data' })
  @ApiResponse({ status: 200, description: 'Admin data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires admin role)' })
  getAdminData() {
    return { role: 'admin', data: 'secure-data' };
  }

  @Get('editor-only')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('editor')
  @ApiOperation({ summary: 'Get secure editor data' })
  @ApiResponse({ status: 200, description: 'Editor data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires editor role)' })
  getEditorData() {
    return { role: 'editor', data: 'secure-data' };
  }
}

