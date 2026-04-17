import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class CandidateAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.query?.token as string;

    if (!token) {
      throw new UnauthorizedException('Interview token required');
    }

    const payload = this.authService.validateCandidateToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired interview token');
    }

    request.candidatePayload = payload;
    return true;
  }
}
