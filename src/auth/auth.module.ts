import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { UserModule } from '../user/user.module';
import { CandidateAuthGuard } from './guards/candidate-auth.guard';
import { CandidateSessionGuard } from './guards/candidate-session.guard';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';

@Module({
  imports: [
    UserModule,
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
  ],
  exports: [
    AuthService,
    CandidateAuthGuard,
    CandidateSessionGuard,
    LoginThrottlerGuard,
  ],
})
export class AuthModule {}
