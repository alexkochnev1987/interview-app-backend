import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Re-exports guards that only depend on `PassportModule` and `Reflector` so leaf modules
 * (e.g. `UserModule`, `QuestionModule`) can import them without dragging in `AuthModule` /
 * `AuthService` / `UserService` directly.
 */
@Module({
  imports: [PassportModule],
  providers: [JwtAuthGuard, PermissionsGuard],
  exports: [JwtAuthGuard, PermissionsGuard],
})
export class AuthGuardsModule {}
