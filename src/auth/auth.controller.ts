import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';
import { RegisterThrottlerGuard } from './guards/register-throttler.guard';
import { getEffectivePermissions } from './permissions';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { MeResponse } from './interfaces/me.interface';
import { AuthUserResponseDto } from './dto/auth-user.response.dto';
import { LogoutResponseDto } from './dto/logout.response.dto';
import {
  getStaffSessionCookieOptions,
  STAFF_SESSION_COOKIE,
} from './staff-session';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: minutes(1),
      blockDuration: minutes(15),
    },
  })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const token = this.authService.login(user);
    res.cookie(STAFF_SESSION_COOKIE, token, getStaffSessionCookieOptions());
    return user;
  }

  @Post('demo')
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  @Throttle({
    default: {
      limit: 10,
      ttl: minutes(1),
    },
  })
  @ApiOperation({ summary: 'Sign in to the read-only demo account' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Demo access is not available' })
  @ApiTooManyRequestsResponse({ description: 'Too many demo sign-in attempts' })
  async demo(@Res({ passthrough: true }) res: Response) {
    const user = await this.authService.demoLogin();
    const token = this.authService.login(user);
    res.cookie(STAFF_SESSION_COOKIE, token, getStaffSessionCookieOptions());
    return user;
  }

  @Post('register')
  @HttpCode(201)
  @UseGuards(RegisterThrottlerGuard)
  @Throttle({
    default: {
      limit: 3,
      ttl: minutes(1),
      blockDuration: minutes(60),
    },
  })
  @ApiOperation({ summary: 'Register a new account' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: AuthUserResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    const token = this.authService.login(user);
    res.cookie(STAFF_SESSION_COOKIE, token, getStaffSessionCookieOptions());
    return user;
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth sign-in flow' })
  @ApiFoundResponse({ description: 'Redirects to Google OAuth consent screen' })
  googleLogin() {
    // Guard redirects to Google automatically
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @ApiFoundResponse({ description: 'Sets session cookie and redirects to frontend' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const googleUser = req.user as { email: string; name: string };
    const user = await this.authService.findOrCreateGoogleUser(
      googleUser.email,
      googleUser.name,
    );
    const token = this.authService.login(user);
    res.cookie(STAFF_SESSION_COOKIE, token, getStaffSessionCookieOptions());
    res.redirect(FRONTEND_URL);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign out current user' })
  @ApiOkResponse({ type: LogoutResponseDto })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(STAFF_SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('sessionAuth')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session cookie' })
  me(@CurrentUser() user: Omit<User, 'passwordHash'>): MeResponse {
    return {
      ...user,
      permissions: getEffectivePermissions(user.role, user.demo),
    };
  }
}
