import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Re-exports guards that only depend on `Reflector` so leaf modules
 * (e.g. `UserModule`) can import them without dragging in `AuthService` /
 * `UserService` directly.
 *
 * `JwtAuthGuard` relies on the `JwtStrategy` registered in `AuthModule`. The
 * `forwardRef(() => AuthModule)` makes that dependency explicit: Nest will
 * always boot `AuthModule` (and therefore the strategy) when this module is
 * loaded, instead of relying on the rest of the graph happening to import
 * `AuthModule` elsewhere. The forwardRef on both sides resolves the cycle
 * `AuthModule → AuthGuardsModule → AuthModule`.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [JwtAuthGuard, PermissionsGuard],
  exports: [JwtAuthGuard, PermissionsGuard],
})
export class AuthGuardsModule {}
