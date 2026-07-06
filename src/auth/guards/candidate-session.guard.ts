import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiErrorCode } from '../../common/errors/api-error.codes';
import { apiUnauthorized } from '../../common/errors/api-error';
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
      throw apiUnauthorized(
        ApiErrorCode.CANDIDATE_SESSION_REQUIRED,
        'Candidate session required',
      );
    }

    const payload = this.authService.validateCandidateToken(token);
    if (!payload) {
      throw apiUnauthorized(
        ApiErrorCode.INVALID_CANDIDATE_SESSION,
        'Invalid or expired candidate session',
      );
    }

    request.candidatePayload = payload;
    request.candidateTokenSource = 'cookie';
    return true;
  }
}
