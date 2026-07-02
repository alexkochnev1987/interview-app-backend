import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiErrorCode } from '../../common/errors/api-error.codes';
import { apiUnauthorized } from '../../common/errors/api-error';
import { AuthService } from '../auth.service';
import { CANDIDATE_SESSION_COOKIE } from '../candidate-session';

@Injectable()
export class CandidateAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const queryToken = request.query?.token as string | undefined;
    const cookieToken = request.cookies?.[CANDIDATE_SESSION_COOKIE] as
      | string
      | undefined;
    const token = queryToken ?? cookieToken;

    if (!token) {
      throw apiUnauthorized(
        ApiErrorCode.INTERVIEW_TOKEN_REQUIRED,
        'Interview token required',
      );
    }

    const payload = this.authService.validateCandidateToken(token);
    if (!payload) {
      throw apiUnauthorized(
        ApiErrorCode.INVALID_INTERVIEW_TOKEN,
        'Invalid or expired interview token',
      );
    }

    request.candidatePayload = payload;
    request.candidateTokenSource = queryToken ? 'query' : 'cookie';
    return true;
  }
}
