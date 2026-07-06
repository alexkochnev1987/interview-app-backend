import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiUnauthorized } from '../common/errors/api-error';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { UserService } from '../user/user.service';
import { User } from '../user/interfaces/user.interface';
import { UserRole } from '../user/interfaces/user.interface';
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
  ) {}

  async validateUser(email: string, password: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw apiUnauthorized(ApiErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    const isValid = await this.userService.validatePassword(user, password);
    if (!isValid) {
      throw apiUnauthorized(ApiErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
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
  ): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userService.findByEmail(email);
    if (existing) {
      return this.userService.toPublicUser(existing);
    }

    return this.userService.create({
      email,
      name,
      password: randomUUID(), // random password, login only via Google
      role: this.getRoleForEmail(email),
    });
  }

  async register(dto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
    // Self-registration must never grant elevated roles. Both privileged-email
    // and already-registered cases return the same generic 400 (not a 409) to
    // avoid leaking which addresses are taken or privileged.
    if (this.isSuperAdminEmail(dto.email) || (await this.userService.findByEmail(dto.email))) {
      throw new BadRequestException('Unable to complete registration');
    }

    return this.userService.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
      role: 'candidate',
    });
  }

  generateCandidateToken(interviewId: string): string {
    const payload = { interviewId, role: 'candidate' };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
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
    const configured = process.env.SUPER_ADMIN_EMAILS
      ?.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const superAdminEmails = configured?.length
      ? configured
      : DEFAULT_SUPER_ADMIN_EMAILS;

    return superAdminEmails.includes(email.trim().toLowerCase());
  }
}
