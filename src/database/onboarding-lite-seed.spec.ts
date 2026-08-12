import {
  buildOnboardingLiteInterview,
  onboardingStarterStableId,
  shouldSeedOnboardingLitePack,
} from './onboarding-lite-seed';

describe('onboarding lite seed', () => {
  it('seeds only dashboard roles that run the staff onboarding tour', () => {
    expect(shouldSeedOnboardingLitePack('hr')).toBe(true);
    expect(shouldSeedOnboardingLitePack('admin')).toBe(true);
    expect(shouldSeedOnboardingLitePack('super_admin')).toBe(true);
    expect(shouldSeedOnboardingLitePack('candidate')).toBe(false);
    expect(shouldSeedOnboardingLitePack('hr', true)).toBe(false);
  });

  it('builds one ready-to-score interview with embedded questions', () => {
    const userId = '00000000-0000-4000-8000-000000000099';
    const interview = buildOnboardingLiteInterview(userId);

    expect(interview.status).toBe('in_progress');
    expect(interview.result).toBeUndefined();
    expect(interview.questions).toHaveLength(2);
    expect(interview.answers).toHaveLength(2);
    expect(
      interview.answers.every((answer) => answer.status === 'submitted'),
    ).toBe(true);
    expect(
      interview.answers.every(
        (answer) => answer.evaluation?.overallScore === undefined,
      ),
    ).toBe(true);
    expect(
      interview.answers.every(
        (answer) => !answer.mediaKey && !answer.screenMediaKey,
      ),
    ).toBe(true);
    expect(interview.candidateEmail).toBe(
      `${userId}@onboarding-starter.sample`,
    );
    expect(onboardingStarterStableId(userId, 'interview')).toBe(interview.id);
  });
});
