import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/interfaces/user.interface';

interface CandidatePayload {
  interviewId: string;
  role: 'candidate';
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<Omit<User, 'passwordHash'>> {
    const user = this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.userService.validatePassword(user, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
    };
  }

  login(user: Omit<User, 'passwordHash'>): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, { expiresIn: '24h' });
  }

  async findOrCreateGoogleUser(
    email: string,
    name: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const existing = this.userService.findByEmail(email);
    if (existing) {
      return {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role,
        organizationId: existing.organizationId,
        createdAt: existing.createdAt,
      };
    }

    // New Google user — create as HR by default
    // Admin can promote later
    return this.userService.create({
      email,
      name,
      password: crypto.randomUUID(), // random password, login only via Google
      role: 'hr',
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
}
