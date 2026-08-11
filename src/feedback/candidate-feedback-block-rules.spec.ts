import {
  canRegenerateCandidateFeedbackBlock,
  getHrPatchBlockReason,
  getRegenerationBlockReason,
  hasPublishableCandidateFeedbackText,
  isCandidateFeedbackBlockProtected,
  resolveHrPatchFeedbackText,
} from './candidate-feedback-block-rules';
import { resolveCandidateFeedbackQuestionSourceText } from './candidate-feedback-source-text';
import { CandidateFeedbackQuestion } from './interfaces/candidate-feedback.interface';

describe('candidate feedback rules', () => {
  it('locks accepted/edited and in-progress blocks from regeneration', () => {
    expect(isCandidateFeedbackBlockProtected('accepted')).toBe(true);
    expect(isCandidateFeedbackBlockProtected('edited')).toBe(true);
    expect(canRegenerateCandidateFeedbackBlock('generating')).toBe(false);
    expect(canRegenerateCandidateFeedbackBlock('generated')).toBe(true);
    expect(canRegenerateCandidateFeedbackBlock('failed')).toBe(true);
    expect(getHrPatchBlockReason('generating')).toBe('in_progress');
    expect(getHrPatchBlockReason('generated')).toBeNull();
  });

  it('allows regeneration for auto-prefilled eligibility skip templates', () => {
    expect(
      getRegenerationBlockReason('edited', {
        errorMessage: 'unusable_transcript',
      }),
    ).toBeNull();
    expect(
      canRegenerateCandidateFeedbackBlock('edited', {
        errorMessage: 'missing_transcript',
      }),
    ).toBe(true);
    expect(
      getRegenerationBlockReason('edited', {
        errorMessage: 'HR manually edited',
      }),
    ).toBe('locked');
    expect(
      getRegenerationBlockReason('accepted', {
        errorMessage: 'unusable_transcript',
      }),
    ).toBe('locked');
  });

  it('requires publishable text when locking a block via HR patch', () => {
    expect(
      hasPublishableCandidateFeedbackText({
        recommendationText: ' Strengths ',
      }),
    ).toBe(true);
    expect(
      hasPublishableCandidateFeedbackText({
        recommendationText: '   ',
        improvementText: '',
      }),
    ).toBe(false);
    expect(
      resolveHrPatchFeedbackText(
        { recommendationText: 'Stored recommendation' },
        { improvementText: 'Patched improvement' },
      ),
    ).toEqual({
      recommendationText: 'Stored recommendation',
      improvementText: 'Patched improvement',
    });
  });

  it('picks best-available per-question texts for overall synthesis', () => {
    const base = {
      id: '1',
      candidateFeedbackId: 'fb',
      questionId: 'q',
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Partial<CandidateFeedbackQuestion>;

    expect(
      resolveCandidateFeedbackQuestionSourceText({
        ...base,
        questionIndex: 0,
        state: 'edited',
        recommendationText: 'Final',
        improvementText: 'Grow',
      } as CandidateFeedbackQuestion),
    ).toEqual({
      questionIndex: 0,
      questionId: 'q',
      recommendationText: 'Final',
      improvementText: 'Grow',
    });

    expect(
      resolveCandidateFeedbackQuestionSourceText({
        ...base,
        questionIndex: 1,
        state: 'failed',
        recommendationText: 'ignored',
      } as CandidateFeedbackQuestion),
    ).toBeNull();
  });
});
