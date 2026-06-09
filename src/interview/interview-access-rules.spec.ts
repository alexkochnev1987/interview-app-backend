import {
  getInterviewAccessDenialReason,
  INTERVIEW_ACCESS_DENIED_MESSAGE,
} from './interview-access-rules';

describe('interview-access-rules', () => {
  const interview = { createdById: 'hr-owner' };

  it('allows super_admin and admin', () => {
    expect(
      getInterviewAccessDenialReason(interview, {
        id: 'a1',
        role: 'super_admin',
      }),
    ).toBeNull();
    expect(
      getInterviewAccessDenialReason(interview, { id: 'a2', role: 'admin' }),
    ).toBeNull();
  });

  it('allows HR only for interviews they created', () => {
    expect(
      getInterviewAccessDenialReason(interview, {
        id: 'hr-owner',
        role: 'hr',
      }),
    ).toBeNull();
    expect(
      getInterviewAccessDenialReason(interview, {
        id: 'other-hr',
        role: 'hr',
      }),
    ).toBe(INTERVIEW_ACCESS_DENIED_MESSAGE);
  });

  it('denies candidates', () => {
    expect(
      getInterviewAccessDenialReason(interview, {
        id: 'c1',
        role: 'candidate',
      }),
    ).toBe(INTERVIEW_ACCESS_DENIED_MESSAGE);
  });
});
