import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UserModule } from '../user/user.module';
import { AuthGuardsModule } from './auth-guards.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CandidateAuthGuard } from './guards/candidate-auth.guard';
import { CandidateSessionGuard } from './guards/candidate-session.guard';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';
import { RegisterThrottlerGuard } from './guards/register-throttler.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UserModule,
    forwardRef(() => AuthGuardsModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    CandidateAuthGuard,
    CandidateSessionGuard,
    LoginThrottlerGuard,
    RegisterThrottlerGuard,
  ],
  exports: [
    AuthService,
    AuthGuardsModule,
    CandidateAuthGuard,
    CandidateSessionGuard,
    LoginThrottlerGuard,
    RegisterThrottlerGuard,
  ],
})
export class AuthModule {}
