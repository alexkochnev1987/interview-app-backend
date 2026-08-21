import { randomUUID } from 'crypto';

import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AppConfigService } from '../app-config/app-config.service';
import { apiForbidden, apiUnauthorized } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { User } from '../user/interfaces/user.interface';
import { UserRole } from '../user/interfaces/user.interface';
import { UserService } from '../user/user.service';
import { CANDIDATE_SESSION_TTL_MS } from './candidate-session';
import { RegisterDto } from './dto/register.dto';

interface CandidatePayload {
  interviewId: string;
  role: 'candidate';
  exp: number;
}

const DEFAULT_SUPER_ADMIN_EMAILS = [
  'admin@interview-app.com',
  'alexkochnev1987@gmail.com',
];

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @Optional() private readonly appConfig?: AppConfigService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw apiUnauthorized(
        ApiErrorCode.INVALID_CREDENTIALS,
        'Invalid credentials',
      );
    }

    const isValid = await this.userService.validatePassword(user, password);
    if (!isValid) {
      throw apiUnauthorized(
        ApiErrorCode.INVALID_CREDENTIALS,
        'Invalid credentials',
      );
    }

    return this.userService.toPublicUser(user);
  }

  login(user: Omit<User, 'passwordHash'>): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, { expiresIn: '24h' });
  }

  async demoLogin(): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userService.findDemoUser();
    if (!user) {
      throw new ServiceUnavailableException('Demo access is not available');
    }
    return this.userService.toPublicUser(user);
  }

  async findOrCreateGoogleUser(
    email: string,
    name: string,
    pictureUrl?: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    if (
      (await this.appConfig?.getBoolean('ENABLE_GOOGLE_OAUTH', true)) === false
    ) {
      throw apiForbidden(
        ApiErrorCode.FORBIDDEN,
        'Google OAuth is currently disabled',
      );
    }

    const existing = await this.userService.findByEmail(email);
    if (existing) {
      // Activates the Google photo as the active picture unless the user
      // currently has a custom upload (see UserService.activateGoogleAvatar).
      if (pictureUrl) {
        return this.userService.activateGoogleAvatar(existing.id, pictureUrl);
      }
      return this.userService.toPublicUser(existing);
    }

    return this.userService.create({
      email,
      name,
      password: randomUUID(), // random password, login only via Google
      role: this.getRoleForEmail(email),
      googlePictureUrl: pictureUrl,
    });
  }

  async register(dto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
    if (await this.appConfig?.getBoolean('DISABLE_USER_REGISTRATION', false)) {
      throw apiForbidden(
        ApiErrorCode.FORBIDDEN,
        'User registration is temporarily disabled',
      );
    }

    // Self-registration must never grant elevated roles. Both privileged-email
    // and already-registered cases return the same generic 400 (not a 409) to
    // avoid leaking which addresses are taken or privileged.
    if (
      this.isSuperAdminEmail(dto.email) ||
      (await this.userService.findByEmail(dto.email))
    ) {
      throw new BadRequestException('Unable to complete registration');
    }

    return this.userService.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
      role: 'candidate',
    });
  }

  async completeOnboarding(
    userId: string,
    status: 'completed' | 'skipped',
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.userService.completeOnboarding(userId, status);
  }

  generateCandidateToken(interviewId: string): string {
    const payload = { interviewId, role: 'candidate' };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  /**
   * Short-lived variant for the candidate-portal "continue" link: the take
   * flow only ever reads this token once, on the very first `GET /take/:id`
   * call, before swapping it for the httpOnly candidate-session cookie — so
   * a long-lived token here only adds needless exposure (logs, browser
   * history, Referer headers) for a value that's consumed within seconds.
   */
  generateCandidatePortalContinueToken(interviewId: string): string {
    const payload = { interviewId, role: 'candidate' };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  generateCandidateSessionToken(interviewId: string): string {
    const payload = { interviewId, role: 'candidate' };
    return this.jwtService.sign(payload, {
      expiresIn: Math.floor(CANDIDATE_SESSION_TTL_MS / 1000),
    });
  }

  validateCandidateToken(token: string): CandidatePayload | null {
    try {
      const payload = this.jwtService.verify<CandidatePayload>(token);
      if (payload.role !== 'candidate') return null;
      return payload;
    } catch {
      return null;
    }
  }

  private getRoleForEmail(email: string): UserRole {
    return this.isSuperAdminEmail(email) ? 'super_admin' : 'candidate';
  }

  private isSuperAdminEmail(email: string): boolean {
    const configured = process.env.SUPER_ADMIN_EMAILS?.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const superAdminEmails = configured?.length
      ? configured
      : DEFAULT_SUPER_ADMIN_EMAILS;

    return superAdminEmails.includes(email.trim().toLowerCase());
  }
}
