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
import { effectiveOwnerId } from '../../shared/utils/business-scope.util';

// Staff management is for a business owner (or their manager) managing
// their own business's staff. Super admin is a pure overseer — it can list
// staff for visibility, but does not create/edit/deactivate staff itself;
// that's the business owner's job. Owning a business is a separate,
// super-admin-only flow (see SuperAdminController.onboardBusinessOwner).
@ApiTags('Admin - Staff Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List staff — scoped to the caller's own business unless super admin" })
  async listStaff(
    @CurrentUser() user: any,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.listStaff({
      limit: +limit, offset: +offset, search, role: role as UserRole,
      ownerId: effectiveOwnerId(user),
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get staff details' })
  async getStaffDetails(@Param('id') staffId: string, @CurrentUser() user: any) {
    return this.adminService.getStaffDetails(staffId, effectiveOwnerId(user));
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: "Add a new staff member (Manager/Waiter/Bar/Kitchen/Door) to the caller's own business" })
  async addStaff(
    @Body() addStaffDto: AddStaffDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.adminService.addStaff(addStaffDto, user, ipAddress);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: "Update a staff member's role, within the caller's own business" })
  async updateStaffRole(
    @Param('id') staffId: string,
    @Body() updateRoleDto: UpdateStaffRoleDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.adminService.updateStaffRole(
      staffId, updateRoleDto.role as UserRole, user, effectiveOwnerId(user), ipAddress,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: "Deactivate a staff member, within the caller's own business" })
  async deactivateStaff(
    @Param('id') staffId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.adminService.deactivateStaff(staffId, user, effectiveOwnerId(user), ipAddress);
  }
}
