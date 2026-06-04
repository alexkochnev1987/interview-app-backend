import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

describe('AuthService candidate tokens', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'unit-test-jwt-secret' })],
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {},
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  it('returns null for missing, malformed, and wrong-role tokens', () => {
    expect(authService.validateCandidateToken('')).toBeNull();
    expect(authService.validateCandidateToken('not-a-jwt')).toBeNull();

    const staffToken = jwtService.sign({
      sub: 'user-1',
      email: 'staff@test.local',
      role: 'admin',
    });
    expect(authService.validateCandidateToken(staffToken)).toBeNull();
  });

  it('accepts a valid candidate invite token', () => {
    const token = authService.generateCandidateToken('interview-123');
    expect(authService.validateCandidateToken(token)).toEqual(
      expect.objectContaining({
        interviewId: 'interview-123',
        role: 'candidate',
      }),
    );
  });

  it('rejects expired candidate tokens', () => {
    const token = jwtService.sign(
      { interviewId: 'interview-expired', role: 'candidate' },
      { expiresIn: 0 },
    );
    expect(authService.validateCandidateToken(token)).toBeNull();
  });
});
