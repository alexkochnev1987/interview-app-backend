import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { UserService } from '../user/user.service';
import { User } from '../user/interfaces/user.interface';
import { UserRole } from '../user/interfaces/user.interface';

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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.userService.validatePassword(user, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.userService.toPublicUser(
      await this.syncRoleWithEmailPolicy(user),
    );
  }

  login(user: Omit<User, 'passwordHash'>): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, { expiresIn: '24h' });
  }

  async findOrCreateGoogleUser(
    email: string,
    name: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userService.findByEmail(email);
    if (existing) {
      return this.userService.toPublicUser(
        await this.syncRoleWithEmailPolicy(existing),
      );
    }

    const role = this.getRoleForEmail(email);
    return this.userService.create({
      email,
      name,
      password: randomUUID(), // random password, login only via Google
      role,
    });
  }

  generateCandidateToken(interviewId: string): string {
    const payload = { interviewId, role: 'candidate' };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
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

  private async syncRoleWithEmailPolicy(user: User): Promise<User> {
    if (!this.isSuperAdminEmail(user.email) || user.role === 'super_admin') {
      return user;
    }

    return (await this.userService.updateRole(user.id, 'super_admin')) ?? user;
  }

  private getRoleForEmail(email: string): UserRole {
    return this.isSuperAdminEmail(email) ? 'super_admin' : 'hr';
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
