import { Controller, Get, UseGuards, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }    from '../../common/guards/jwt-auth.guard';
import { RolesGuard }      from '../../common/guards/roles.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Roles }           from '../../common/decorators/roles.decorator';
import { AuditService }    from './audit.service';
import { CurrentUser }     from '../../common/decorators/current-user.decorator';
import { UserRole }        from '../../shared/enums';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  // SUPER_ADMIN only — full platform audit log is in super-admin/audit-logs
  // This route gives ADMIN a scoped view: only logs they or their team created
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get audit logs scoped to current admin actor' })
  async getMyAuditLogs(
    @CurrentUser() user: any,
    @Query('limit')  limit  = 50,
    @Query('offset') offset = 0,
  ) {
    // Regular ADMIN sees only their own actions
    // SUPER_ADMIN auto-passes RolesGuard and sees everything (via super-admin/audit-logs)
    return this.auditService.getAuditTrail(user.id, limit, offset);
  }

  // Any ADMIN or MANAGER can look up audit trail for a specific resource
  // e.g. "show me all changes to booking X"
  @Get('resource/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get audit trail for a specific resource (booking, payment, etc)' })
  async getResourceAudit(
    @Param('resourceId') resourceId: string,
    @Query('limit')  limit  = 50,
    @Query('offset') offset = 0,
  ) {
    return this.auditService.getAuditTrail(resourceId, limit, offset);
  }
}