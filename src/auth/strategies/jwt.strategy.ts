import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UserService } from '../../user/user.service';

function extractJwtFromCookie(req: Request): string | null {
  return req?.cookies?.session ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: extractJwtFromCookie,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    });
  }

  async validate(payload: { sub: string; role: string }) {
    const user = await this.userService.findById(payload.sub);
    if (!user) return null;
    return this.userService.toPublicUser(user);
  }
}
