import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { IpAddress }    from '../../common/decorators/ip-address.decorator';
import { AddStaffDto, UpdateStaffRoleDto } from '../../shared/dtos/admin.dto';
import { AdminService } from './admin.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Admin - Staff Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all staff' })
  async listStaff(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.listStaff({
      limit: +limit, offset: +offset, search, role: role as UserRole,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get staff details' })
  async getStaffDetails(@Param('id') staffId: string) {
    return this.adminService.getStaffDetails(staffId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Add new staff member' })
  async addStaff(
    @Body() addStaffDto: AddStaffDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.adminService.addStaff(addStaffDto, user.id, ipAddress);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Update staff role' })
  async updateStaffRole(
    @Param('id') staffId: string,
    @Body() updateRoleDto: UpdateStaffRoleDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.adminService.updateStaffRole(
      staffId, updateRoleDto.role as UserRole, user.id, ipAddress,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a staff member' })
  async deactivateStaff(
    @Param('id') staffId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.adminService.deactivateStaff(staffId, user.id, ipAddress);
  }
}