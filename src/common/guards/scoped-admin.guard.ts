import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, BusinessScope } from '../../shared/enums';

export const REQUIRED_SCOPE_KEY = 'requiredScope';

export function RequiredScope(scope: BusinessScope) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(REQUIRED_SCOPE_KEY, scope, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class ScopedAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.get<BusinessScope>(
      REQUIRED_SCOPE_KEY, context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Authentication required');

    if (user.role === UserRole.SUPER_ADMIN) {
      request.adminScopes = null;
      return true;
    }

    request.adminScopes = user.businessScopes ?? [];

    if (!requiredScope) return true;

    const scopes: BusinessScope[] = user.businessScopes ?? [];
    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `This action requires the ${requiredScope} business scope`,
      );
    }

    return true;
  }
}