import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../shared/enums';

/**
 * SuperAdminGuard — restricts routes to SUPER_ADMIN only.
 *
 * Use this on routes that manage:
 * - Service charge configuration
 * - Platform commission rates
 * - Any other system-wide financial settings
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, SuperAdminGuard)
 *   @Patch('settings/service-charge')
 *   async updateServiceCharge(...) {}
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'This action requires SUPER_ADMIN privileges',
      );
    }

    return true;
  }
}