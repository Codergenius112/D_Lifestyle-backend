import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../shared/enums';

@Injectable()
export class WalletPrivacyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Authentication required');

    const blockedRoles = [
      UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN,
      UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.BAR_STAFF, UserRole.DOOR_STAFF,
    ];

    if (blockedRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Admin roles cannot access wallet data. Use /super-admin/financials for platform-level aggregates.',
      );
    }

    return true;
  }
}