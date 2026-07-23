import {
  CandidateFeedback,
  CandidateFeedbackQuestion,
} from './interfaces/candidate-feedback.interface';
import {
  filterPublishableOverall,
  filterPublishableQuestions,
  hasAnyPublishableCandidateFeedbackBlock,
  isPublishableCandidateFeedbackBlock,
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

describe('candidate feedback share publishable helpers', () => {
  it('treats accepted/edited with non-empty text as publishable', () => {
    expect(
      isPublishableCandidateFeedbackBlock('accepted', {
        recommendationText: ' Strengths ',
      }),
    ).toBe(true);
    expect(
      isPublishableCandidateFeedbackBlock('edited', {
        improvementText: 'Grow',
      }),
    ).toBe(true);
  });

  it('rejects generated/failed and empty accepted/edited blocks', () => {
    expect(
      isPublishableCandidateFeedbackBlock('generated', {
        recommendationText: 'Still draft',
      }),
    ).toBe(false);
    expect(
      isPublishableCandidateFeedbackBlock('accepted', {
        recommendationText: '   ',
        improvementText: '',
      }),
    ).toBe(false);
  });

  it('gates create when no publishable overall or question blocks exist', () => {
    expect(
      hasAnyPublishableCandidateFeedbackBlock(
        makeFeedback({
          overallState: 'generated',
          overallRecommendationText: 'Draft overall',
          questions: [
            makeQuestion({
              questionIndex: 0,
              questionId: 'q1',
              state: 'accepted',
              recommendationText: '   ',
            }),
          ],
        }),
      ),
    ).toBe(false);

    expect(
      hasAnyPublishableCandidateFeedbackBlock(
        makeFeedback({
          overallState: 'accepted',
          overallRecommendationText: 'Ready',
        }),
      ),
    ).toBe(true);
  });

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

  it('includes publishable overall and omits questions when none qualify', () => {
    const feedback = makeFeedback({
      overallState: 'edited',
      overallRecommendationText: 'Overall strengths',
      overallImprovementText: 'Overall growth',
      questions: [
        makeQuestion({
          questionIndex: 0,
          questionId: 'q1',
          state: 'failed',
          recommendationText: 'ignored',
        }),
      ],
    });

    expect(
      presentPublicCandidateFeedback(feedback, {
        interviewLocale: 'ru',
        position: 'HR',
        expiresAt: new Date('2026-02-01T12:00:00.000Z'),
      }),
    ).toEqual({
      interviewLocale: 'ru',
      position: 'HR',
      expiresAt: '2026-02-01T12:00:00.000Z',
      overall: {
        recommendationText: 'Overall strengths',
        improvementText: 'Overall growth',
      },
    });
  });

  it('includes overallScore when interview result has it', () => {
    const feedback = makeFeedback({
      overallState: 'accepted',
      overallRecommendationText: 'Ready',
    });

    expect(
      presentPublicCandidateFeedback(feedback, {
        interviewLocale: 'en',
        position: 'Engineer',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        overallScore: 62,
      }),
    ).toEqual({
      interviewLocale: 'en',
      position: 'Engineer',
      expiresAt: '2026-01-08T00:00:00.000Z',
      overallScore: 62,
      overall: {
        recommendationText: 'Ready',
      },
    });
  });

  it('omits overallScore when interview result score is missing', () => {
    const feedback = makeFeedback({
      overallState: 'accepted',
      overallRecommendationText: 'Ready',
    });

    const payload = presentPublicCandidateFeedback(feedback, {
      interviewLocale: 'en',
      position: 'Engineer',
      expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    });

    expect(payload).not.toHaveProperty('overallScore');
  });

  it('includes outcome when set and omits when missing', () => {
    const withOutcome = makeFeedback({
      overallState: 'accepted',
      overallRecommendationText: 'Ready',
      outcome: 'next_stage',
    });
    const withoutOutcome = makeFeedback({
      overallState: 'accepted',
      overallRecommendationText: 'Ready',
    });

    expect(
      presentPublicCandidateFeedback(withOutcome, {
        interviewLocale: 'en',
        position: 'Engineer',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      }),
    ).toMatchObject({ outcome: 'next_stage' });

    expect(
      presentPublicCandidateFeedback(withoutOutcome, {
        interviewLocale: 'en',
        position: 'Engineer',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      }),
    ).not.toHaveProperty('outcome');
  });

  it('includes custom outcomeMessage on public payload and omits it for presets', () => {
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
