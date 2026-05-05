import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * AND semantics: the actor must hold *all* listed permissions.
 * Enforced by `PermissionsGuard`. For OR, introduce a sibling decorator.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
