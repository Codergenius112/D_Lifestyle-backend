import {
  Controller, Get, Post, Delete,
  Body, Param, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { IpAddress }    from '../../common/decorators/ip-address.decorator';
import { BusinessIds }  from '../../common/decorators/business-context.decorator';
import { AdminService } from './admin.service';
import { UserRole, BusinessShareDataType } from '../../shared/enums';
import { IsString, IsArray, IsEnum, ArrayMinSize } from 'class-validator';

class GrantDataShareDto {
  @IsString() fromBusinessId: string;
  @IsString() toBusinessId: string;
  @IsArray() @ArrayMinSize(1) @IsEnum(BusinessShareDataType, { each: true })
  dataTypes: BusinessShareDataType[];
}

// Owner-only: sharing is an ownership-level decision about what crosses a
// business boundary, not something a manager delegates on the owner's
// behalf. See Zentra Multi-Tenancy PRD, section 7.
@ApiTags('Admin - Business Data Sharing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard)
@Controller('admin/data-shares')
export class AdminDataSharingController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List active data shares involving any of the caller\'s own business(es)' })
  async listDataShares(@CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.adminService.listDataShares(businessIds);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Grant a data share from one of the caller\'s businesses to another they also own' })
  async grantDataShare(@Body() dto: GrantDataShareDto, @CurrentUser() user: any, @IpAddress() ipAddress: string) {
    return this.adminService.grantDataShare(dto.fromBusinessId, dto.toBusinessId, dto.dataTypes, user, ipAddress);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke an active data share' })
  async revokeDataShare(@Param('id') id: string, @CurrentUser() user: any, @IpAddress() ipAddress: string) {
    return this.adminService.revokeDataShare(id, user, ipAddress);
  }
}
