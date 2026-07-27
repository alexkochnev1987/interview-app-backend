import {
  CandidateFeedback,
  CandidateFeedbackQuestion,
} from './interfaces/candidate-feedback.interface';
import {
  filterPublishableOverall,
  filterPublishableQuestions,
  presentPublicCandidateFeedback,
} from './present-public-candidate-feedback';

function makeFeedback(
  overrides: Partial<CandidateFeedback> & {
    questions?: CandidateFeedbackQuestion[];
  } = {},
): CandidateFeedback {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'cf-1',
    interviewId: 'interview-1',
    overallState: 'not_generated',
    questions: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeQuestion(
  overrides: Partial<CandidateFeedbackQuestion> & {
    questionIndex: number;
    questionId: string;
  },
): CandidateFeedbackQuestion {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: `qrow-${overrides.questionIndex}`,
    candidateFeedbackId: 'cf-1',
    state: 'generated',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('presentPublicCandidateFeedback', () => {
  it('filters public payload to publishable texts and omits empty sections', () => {
    const feedback = makeFeedback({
      overallState: 'generated',
      overallRecommendationText: 'Not locked',
      questions: [
        makeQuestion({
          questionIndex: 0,
          questionId: 'q1',
          state: 'accepted',
          recommendationText: ' Q1 strengths ',
          improvementText: '  ',
        }),
        makeQuestion({
          questionIndex: 1,
          questionId: 'q2',
          state: 'edited',
          improvementText: 'Q2 growth',
        }),
        makeQuestion({
          questionIndex: 2,
          questionId: 'q3',
          state: 'generated',
          recommendationText: 'Hidden draft',
        }),
      ],
    });

    expect(filterPublishableOverall(feedback)).toBeUndefined();
    expect(filterPublishableQuestions(feedback.questions)).toEqual([
      {
        questionIndex: 0,
        questionId: 'q1',
        recommendationText: 'Q1 strengths',
      },
      {
        questionIndex: 1,
        questionId: 'q2',
        improvementText: 'Q2 growth',
      },
    ]);

    expect(
      presentPublicCandidateFeedback(feedback, {
        interviewLocale: 'en',
        position: 'Engineer',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      }),
    ).toEqual({
      interviewLocale: 'en',
      position: 'Engineer',
      expiresAt: '2026-01-08T00:00:00.000Z',
      questions: [
        {
          questionIndex: 0,
          questionId: 'q1',
          recommendationText: 'Q1 strengths',
        },
        {
          questionIndex: 1,
          questionId: 'q2',
          improvementText: 'Q2 growth',
        },
      ],
    });
  });

  it('includes custom outcomeMessage and omits it for presets', () => {
    const custom = makeFeedback({
      overallState: 'accepted',
      overallRecommendationText: 'Ready',
      outcome: 'custom',
      outcomeMessage: 'HR wrote a custom next-step note.',
    });
    const preset = makeFeedback({
      overallState: 'accepted',
      overallRecommendationText: 'Ready',
      outcome: 'next_stage',
      outcomeMessage: 'Should not leak',
    });

    expect(
      presentPublicCandidateFeedback(custom, {
        interviewLocale: 'en',
        position: 'Engineer',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      }),
    ).toEqual(
      expect.objectContaining({
        outcome: 'custom',
        outcomeMessage: 'HR wrote a custom next-step note.',
      }),
    );

    const presetPayload = presentPublicCandidateFeedback(preset, {
      interviewLocale: 'en',
      position: 'Engineer',
      expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    });
    expect(presetPayload).toMatchObject({ outcome: 'next_stage' });
    expect(presetPayload).not.toHaveProperty('outcomeMessage');
  });
});
