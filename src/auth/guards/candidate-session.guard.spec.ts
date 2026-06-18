import { UnauthorizedException } from '@nestjs/common';
import { CandidateSessionGuard } from './candidate-session.guard';
import { AuthService } from '../auth.service';
import { mockExecutionContext } from '../../test/mock-execution-context';

describe('CandidateSessionGuard', () => {
  const validateCandidateToken = jest.fn();
  const guard = new CandidateSessionGuard({
    validateCandidateToken,
  } as unknown as AuthService);

  beforeEach(() => {
    validateCandidateToken.mockReset();
  });

  it('requires the candidate session cookie', () => {
    const context = mockExecutionContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects invalid session cookies', () => {
    validateCandidateToken.mockReturnValue(null);
    const context = mockExecutionContext({
      cookies: { candidate_session: 'stale-token' },
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts a valid session cookie', () => {
    validateCandidateToken.mockReturnValue({
      interviewId: 'interview-1',
      role: 'candidate',
    });
    const context = mockExecutionContext({
      cookies: { candidate_session: 'valid-token' },
    });
    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.candidateTokenSource).toBe('cookie');
  });
});
