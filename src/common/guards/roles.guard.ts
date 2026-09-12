import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../shared/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator = route is open to any authenticated user
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // SUPER_ADMIN passes every role check automatically
    // They are a superset of all roles — no need to manually add
    // SUPER_ADMIN to every @Roles() decorator across the codebase
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // ← CHANGED (business-awareness fix): prefer effectiveRole — the
    // caller's role for the SPECIFIC business this request targets — over
    // their flat global User.role, when TenantScopeGuard has resolved one
    // (it must run before this guard; see each controller's @UseGuards
    // order). A staff member assigned as "manager" at one business and
    // "waiter" at another now gets checked against whichever one is
    // actually active for this request, not one fixed role everywhere.
    // Falls back to user.role when effectiveRole wasn't resolved (e.g.
    // TenantScopeGuard isn't used on this route, or the caller has
    // multiple businesses and didn't specify which one via X-Business-Id
    // — see TenantScopeGuard for exactly when that fallback applies).
    const roleToCheck: UserRole = request.effectiveRole ?? user.role;

    if (!requiredRoles.includes(roleToCheck)) {
      throw new ForbiddenException(
        `Your role (${roleToCheck}) is not authorized for this action`,
      );
    }

    return true;
  }
}