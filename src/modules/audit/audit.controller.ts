import { Controller, Get, UseGuards, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }    from '../../common/guards/jwt-auth.guard';
import { RolesGuard }      from '../../common/guards/roles.guard';
import { Roles }           from '../../common/decorators/roles.decorator';
import { AuditService }    from './audit.service';
import { CurrentUser }     from '../../common/decorators/current-user.decorator';
import { UserRole }        from '../../shared/enums';
import { effectiveOwnerId } from '../../shared/utils/business-scope.util';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  // Business-wide view: an owner or manager sees every action taken by
  // anyone on their team (themselves + their staff), not just their own.
  // SUPER_ADMIN uses the separate full-platform super-admin/audit-logs route.
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Get audit logs for the caller's own business (owner + all their staff)" })
  async getMyAuditLogs(
    @CurrentUser() user: any,
    @Query('limit')  limit  = 50,
    @Query('offset') offset = 0,
  ) {
    return this.auditService.getBusinessAuditTrail(effectiveOwnerId(user), limit, offset);
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