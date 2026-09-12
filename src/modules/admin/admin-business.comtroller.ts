import { Controller, Get, Patch, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { IpAddress }    from '../../common/decorators/ip-address.decorator';
import { BusinessIds }  from '../../common/decorators/business-context.decorator';
import { AdminService } from './admin.service';
import { UserRole } from '../../shared/enums';
import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

class UpdateMyBusinessDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsObject() payoutDetails?: Record<string, any>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// Powers the admin dashboard's business switcher — an owner or staff
// member with more than one business needs to see which ones they can
// pick from before the X-Business-Id header means anything to them.
@ApiTags('Admin - Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard)
@Controller('admin/businesses')
export class AdminBusinessesController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF, UserRole.DOOR_STAFF, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List every business the caller can act within (owned + assigned-to)' })
  async listMyBusinesses(@CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.adminService.listMyBusinesses(user, businessIds);
  }

  // ← NEW (owner-facing business settings) — deliberately separate from
  // the super-admin-only /super-admin/businesses/:id/scopes and /status
  // endpoints. An owner can rename their business, update payout details,
  // and pause it themselves (isActive) — but cannot touch what it's
  // allowed to do (scopes) or its platform-level lifecycle (status).
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: "Update a business's own settings (name, payout details, active toggle) — owner only" })
  async updateMyBusiness(
    @Param('id') businessId: string,
    @Body() dto: UpdateMyBusinessDto,
    @CurrentUser() user: any,
    @IpAddress() ip: string,
  ) {
    return this.adminService.updateMyBusiness(businessId, dto, user, ip);
  }
}
