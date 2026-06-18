import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { CANDIDATE_SESSION_COOKIE } from '../candidate-session';

@Injectable()
export class CandidateSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[CANDIDATE_SESSION_COOKIE] as
      | string
      | undefined;

    if (!token) {
      throw new UnauthorizedException('Candidate session required');
    }

    const payload = this.authService.validateCandidateToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired candidate session');
    }

    request.candidatePayload = payload;
    request.candidateTokenSource = 'cookie';
    return true;
  }
}
