import type { Interview } from './interfaces/interview.interface';
import { getInterviewResultsUnavailableMessage } from './interview-results-rules';

function interview(
  partial: Pick<Interview, 'status' | 'result'>,
): Pick<Interview, 'status' | 'result'> {
  return partial;
}

describe('interview-results-rules', () => {
  it('reports results unavailable before interview is completed', () => {
    expect(
      getInterviewResultsUnavailableMessage(
        interview({ status: 'in_progress' }),
        'int-1',
      ),
    ).toBe(
      'Results for interview "int-1" are not available yet (status: in_progress)',
    );
  });

  it('reports results unavailable when completed status lacks a result', () => {
    expect(
      getInterviewResultsUnavailableMessage(
        interview({ status: 'completed' }),
        'int-2',
      ),
    ).toBe(
      'Results for interview "int-2" are not available yet (status: completed)',
    );
  });

  it('allows results when interview is completed with a result', () => {
    expect(
      getInterviewResultsUnavailableMessage(
        interview({
          status: 'completed',
          result: {
            overallScore: 80,
            summary: 'Strong answers.',
            categoryScores: {},
            rubricVersion: 'mvp-v1',
            decision: 'proceed',
            trustScore: 90,
            trustFlags: [],
            behaviorSummary: { riskLevel: 'low', notes: [] },
            questionResults: [],
            interviewLocale: 'en',
            completedAt: new Date('2026-06-05T12:00:00.000Z'),
          },
        }),
        'int-3',
      ),
    ).toBeNull();
  });
});
