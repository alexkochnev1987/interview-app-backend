import { Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';

class LoginDto {
  email: string;
  password: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // 'lax' needed for OAuth redirect
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24h
};

// Frontend URL to redirect after Google login
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const token = this.authService.login(user);
    res.cookie('session', token, COOKIE_OPTIONS);
    return user;
  }

  // Step 1: Redirect to Google
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Guard redirects to Google automatically
  }

  // Step 2: Google redirects back here
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
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
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('session', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: Omit<User, 'passwordHash'>) {
    return user;
  }
}
