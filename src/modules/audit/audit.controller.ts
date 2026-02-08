import { Controller, Get, UseGuards, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getAuditLogs(
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
  ) {
    return this.auditService.getAuditTrail(undefined, limit, offset);
  }

  @Get('resource/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getResourceAudit(
    @Param('resourceId') resourceId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.auditService.getAuditTrail(resourceId, limit, offset);
  }
}
