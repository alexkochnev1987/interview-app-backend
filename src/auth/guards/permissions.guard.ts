import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ApiErrorCode } from '../../common/errors/api-error.codes';
import { apiForbidden, apiUnauthorized } from '../../common/errors/api-error';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { hasPermission, Permission } from '../permissions';
import { UserRole } from '../../user/interfaces/user.interface';

interface AuthenticatedRequest extends Request {
  user?: { role?: UserRole };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private static readonly logger = new Logger(PermissionsGuard.name);
  // Routes already warned about — keeps log volume to one entry per handler
  // per process even under heavy traffic.
  private static readonly warnedHandlers = new Set<string>();

  constructor(private readonly reflector: Reflector) {}

  /**
   * Permission semantics: AND. The decorator `@RequirePermissions(a, b)` means
   * the actor must have *all* listed permissions. If you need OR semantics,
   * introduce a separate decorator/guard rather than overloading this one.
   *
   * Assumes `JwtAuthGuard` runs first and populates `request.user`. The
   * `UnauthorizedException` here only fires as a defensive fallback for
   * misconfigured controllers — production routes should never hit it.
   *
   * Fail-open is intentional for handlers that legitimately need only auth
   * (e.g. `GET /auth/me`). To make accidental omissions visible, the guard
   * logs a warning the first time it sees a `PermissionsGuard`-protected
   * handler with no `@RequirePermissions` metadata. CI can grep these from
   * staging logs to catch missing decorators before they reach prod.
   */
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      this.warnMissingDecorator(context);
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.role;
    if (!role) {
      throw apiUnauthorized(
        ApiErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required',
      );
    }

    const allowed = required.every((permission) => hasPermission(role, permission));
    if (!allowed) {
      throw apiForbidden(
        ApiErrorCode.INSUFFICIENT_PERMISSIONS,
        'Insufficient permissions',
      );
    }
    return true;
  }

  private warnMissingDecorator(context: ExecutionContext): void {
    const handlerKey = `${context.getClass().name}.${context.getHandler().name}`;
    if (PermissionsGuard.warnedHandlers.has(handlerKey)) {
      return;
    }
    PermissionsGuard.warnedHandlers.add(handlerKey);
    PermissionsGuard.logger.warn(
      `${handlerKey} is wrapped in PermissionsGuard but has no @RequirePermissions — ` +
        `the route is accessible to any authenticated user. Add the decorator or ` +
        `remove the guard if this is intentional.`,
    );
  }
}
