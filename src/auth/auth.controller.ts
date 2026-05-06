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
import { getPermissions } from './permissions';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { MeResponse } from './interfaces/me.interface';
import { AuthUserResponseDto } from './dto/auth-user.response.dto';
import { LogoutResponseDto } from './dto/logout.response.dto';

const isLocal = !process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes('localhost');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !isLocal,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24h
};

// Frontend URL to redirect after Google login
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
    res.cookie('session', token, COOKIE_OPTIONS);
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
    res.cookie('session', token, COOKIE_OPTIONS);
    return user;
  }

  // Step 1: Redirect to Google
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth sign-in flow' })
  @ApiFoundResponse({ description: 'Redirects to Google OAuth consent screen' })
  googleLogin() {
    // Guard redirects to Google automatically
  }

  // Step 2: Google redirects back here
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
    res.cookie('session', token, COOKIE_OPTIONS);
    res.redirect(FRONTEND_URL);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign out current user' })
  @ApiOkResponse({ type: LogoutResponseDto })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('session', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session cookie' })
  me(@CurrentUser() user: Omit<User, 'passwordHash'>): MeResponse {
    return {
      ...user,
      permissions: getPermissions(user.role),
    };
  }
}
