import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { AddStaffDto, UpdateStaffRoleDto } from '../../shared/dtos/admin.dto';
import { UserRole } from '../../shared/enums';

@ApiTags('Admin - Staff Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/staff')
export class AdminStaffController {
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List all staff' })
  async listStaff(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return { message: 'Staff list' };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get staff details' })
  async getStaffDetails(@Param('id') staffId: string) {
    return { message: 'Staff details' };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Add new staff member' })
  async addStaff(
    @Body() addStaffDto: AddStaffDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return { message: 'Staff added' };
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Update staff role' })
  async updateStaffRole(
    @Param('id') staffId: string,
    @Body() updateRoleDto: UpdateStaffRoleDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return { message: 'Staff role updated' };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Deactivate staff member' })
  async deactivateStaff(
    @Param('id') staffId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return { message: 'Staff deactivated' };
  }
}