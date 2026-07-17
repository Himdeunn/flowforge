import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all users in the tenant' })
  @ApiResponse({ status: 200, description: 'Success' })
  async list(@Req() req: any) {
    return this.usersService.list(req.user.tenantId);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new user under the tenant' })
  @ApiResponse({ status: 201, description: 'Created' })
  async create(@Req() req: any, @Body() dto: any) {
    return this.usersService.create(req.user.tenantId, dto);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user role or details' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.usersService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user from tenant' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.usersService.delete(req.user.tenantId, id);
  }
}
