import { InterviewActor } from './interfaces/interview.interface';
import {
  assertActorCanSetAssignedHr,
  HR_ASSIGNMENT_FORBIDDEN_MESSAGE,
} from './interview-assignment-rules';

describe('interview-assignment-rules', () => {
  const admin: InterviewActor = { id: 'admin', role: 'admin', demo: false };
  const hr: InterviewActor = { id: 'hr', role: 'hr', demo: false };

  it('allows admins to set or clear assigned HR', () => {
    expect(() =>
      assertActorCanSetAssignedHr(
        admin,
        '00000000-0000-4000-8000-000000000001',
      ),
    ).not.toThrow();
    expect(() => assertActorCanSetAssignedHr(admin, null)).not.toThrow();
  });

  it('allows omitting assigned HR for any role', () => {
    expect(() => assertActorCanSetAssignedHr(hr, undefined)).not.toThrow();
  });

  it('forbids HR from setting or clearing assigned HR', () => {
    expect(() =>
      assertActorCanSetAssignedHr(hr, '00000000-0000-4000-8000-000000000001'),
    ).toThrow(HR_ASSIGNMENT_FORBIDDEN_MESSAGE);
    expect(() => assertActorCanSetAssignedHr(hr, null)).toThrow(
      HR_ASSIGNMENT_FORBIDDEN_MESSAGE,
    );
  });
});
