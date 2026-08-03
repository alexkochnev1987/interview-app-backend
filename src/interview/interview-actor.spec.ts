import { toInterviewActor } from './interview-actor';

describe('toInterviewActor', () => {
  it('includes onboardingCompletedAt for interview list scoping', () => {
    const onboardingCompletedAt = new Date('2026-07-01T00:00:00.000Z');

    expect(
      toInterviewActor({
        id: 'hr-1',
        role: 'hr',
        demo: false,
        email: 'hr@example.com',
        name: 'HR User',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        onboardingCompletedAt,
      }),
    ).toEqual({
      id: 'hr-1',
      role: 'hr',
      demo: false,
      onboardingCompletedAt,
    });
  });
});
