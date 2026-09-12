import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, Query, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { IpAddress }    from '../../common/decorators/ip-address.decorator';
import { BusinessIds, ActiveBusinessId } from '../../common/decorators/business-context.decorator'; // ← NEW (multi-tenancy)
import { AddStaffDto, UpdateStaffRoleDto } from '../../shared/dtos/admin.dto';
import { AdminService } from './admin.service';
import { UserRole } from '../../shared/enums';
import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { BusinessScope } from '../../shared/enums';

class AssignStaffToBusinessDto {
  @IsString() businessId: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @IsArray() scopes?: BusinessScope[];
}

// Staff management is for a business owner (or their manager) managing
// their own business's staff. Super admin is a pure overseer — it can list
// staff for visibility, but does not create/edit/deactivate staff itself;
// that's the business owner's job. Owning a business is a separate,
// super-admin-only flow (see SuperAdminController.onboardBusinessOwner).
// ← CHANGED (multi-tenancy): scoping now runs on StaffBusinessAssignment
// membership (via TenantScopeGuard's businessIds) rather than the old flat
// businessOwnerId equality check, so an owner with more than one business
// sees each one's staff separately unless a staff member is explicitly
// assigned to more than one.
@ApiTags('Admin - Staff Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List staff — scoped to the caller's own business(es) unless super admin" })
  async listStaff(
    @CurrentUser() user: any,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('search') search?: string,
    @Query('role') role?: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    return this.adminService.listStaff({
      limit: +limit, offset: +offset, search, role: role as UserRole,
      businessIds,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get staff details, including every business they are currently assigned to' })
  async getStaffDetails(@Param('id') staffId: string, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.adminService.getStaffDetails(staffId, businessIds);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  @ApiOperation({ summary: "Add a new staff member (Manager/Waiter/Bar/Kitchen/Door) to the caller's own business" })
  async addStaff(
    @Body() addStaffDto: AddStaffDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @ActiveBusinessId() activeBusinessId?: string | null, // ← NEW (multi-tenancy)
  ) {
    if (!activeBusinessId) {
      throw new BadRequestException(
        'Could not determine which business this staff member belongs to. If you manage more than one business, specify one via the X-Business-Id header.',
      );
    }
    return this.adminService.addStaff(addStaffDto, user, ipAddress, activeBusinessId);
  }

  // ← NEW (multi-tenancy) — grants an existing staff member access to a
  // further business the caller owns. See PRD section 6.
  @Post(':id/assignments')
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Assign an existing staff member to one of the caller\'s other businesses' })
  async assignToBusiness(
    @Param('id') staffId: string,
    @Body() dto: AssignStaffToBusinessDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @BusinessIds() businessIds?: string[],
  ) {
    if (businessIds !== undefined && (!businessIds.length || !businessIds.includes(dto.businessId))) {
      throw new BadRequestException('You can only assign staff to a business you own.');
    }
    return this.adminService.assignStaffToBusiness(staffId, dto.businessId, dto.role, dto.scopes ?? null, user, ipAddress);
  }

  // ← NEW (multi-tenancy) — revokes one specific business assignment; the
  // staff member's other assignments (if any) are unaffected.
  @Delete(':id/assignments/:businessId')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: "Revoke a staff member's access to one specific business" })
  async revokeAssignment(
    @Param('id') staffId: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @BusinessIds() businessIds?: string[],
  ) {
    if (businessIds !== undefined && (!businessIds.length || !businessIds.includes(businessId))) {
      throw new BadRequestException('You can only revoke access to a business you own.');
    }
    return this.adminService.revokeStaffAssignment(staffId, businessId, user, ipAddress);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: "Update a staff member's role for one specific business they're assigned to" })
  async updateStaffRole(
    @Param('id') staffId: string,
    @Body() updateRoleDto: UpdateStaffRoleDto,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @BusinessIds() businessIds?: string[],
    @ActiveBusinessId() activeBusinessId?: string | null,
  ) {
    // Explicit businessId in the body wins; otherwise fall back to the
    // resolved active business (works for the common single-business case
    // without the caller needing to pass anything extra).
    const targetBusinessId = updateRoleDto.businessId ?? activeBusinessId;
    if (!targetBusinessId) {
      throw new BadRequestException(
        'Specify which business this role change applies to (businessId in the body, or an X-Business-Id header) — this staff member has more than one active assignment.',
      );
    }
    return this.adminService.updateStaffRole(
      staffId, targetBusinessId, updateRoleDto.role as UserRole, user, businessIds, ipAddress,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: "Deactivate a staff member, within one of the caller's own business(es)" })
  async deactivateStaff(
    @Param('id') staffId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
    @BusinessIds() businessIds?: string[],
  ) {
    return this.adminService.deactivateStaff(staffId, user, businessIds, ipAddress);
  }
}
