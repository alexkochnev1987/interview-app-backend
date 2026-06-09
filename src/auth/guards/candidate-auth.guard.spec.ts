import { UnauthorizedException } from '@nestjs/common';
import { CandidateAuthGuard } from './candidate-auth.guard';
import { AuthService } from '../auth.service';
import { mockExecutionContext } from '../../test/mock-execution-context';

describe('CandidateAuthGuard', () => {
  const validateCandidateToken = jest.fn();
  const guard = new CandidateAuthGuard({
    validateCandidateToken,
  } as unknown as AuthService);

  beforeEach(() => {
    validateCandidateToken.mockReset();
  });

  it('requires a query or cookie token', () => {
    const context = mockExecutionContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects invalid tokens', () => {
    validateCandidateToken.mockReturnValue(null);
    const context = mockExecutionContext({ query: { token: 'bad-token' } });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts a valid query token and marks the source', () => {
    validateCandidateToken.mockReturnValue({
      interviewId: 'interview-1',
      role: 'candidate',
    });
    const context = mockExecutionContext({ query: { token: 'valid-token' } });
    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.candidatePayload.interviewId).toBe('interview-1');
    expect(request.candidateTokenSource).toBe('query');
  });

  it('accepts a valid cookie token', () => {
    validateCandidateToken.mockReturnValue({
      interviewId: 'interview-1',
      role: 'candidate',
    });
    const context = mockExecutionContext({
      cookies: { candidate_session: 'cookie-token' },
    });
    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.candidateTokenSource).toBe('cookie');
  });
});
