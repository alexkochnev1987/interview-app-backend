import {
  buildSkipTemplateTexts,
  isQuestionFeedbackEligibilitySkipReason,
} from './candidate-feedback-skip-templates';

describe('candidate-feedback-skip-templates', () => {
  const questionText = 'Explain database indexing and query plans.';

  it('builds candidate-facing templates by skip reason and locale', () => {
    expect(
      buildSkipTemplateTexts('unusable_transcript', questionText, 'en'),
    ).toEqual({
      recommendationText:
        'The recorded response did not contain a substantive answer to this question.',
      improvementText: expect.stringContaining('Explain database indexing'),
      hrHint: 'unusable_transcript',
    });
    expect(
      buildSkipTemplateTexts('missing_transcript', questionText, 'ru')
        ?.recommendationText,
    ).toContain('устный ответ');
    expect(
      buildSkipTemplateTexts('not_submitted', questionText, 'en')
        ?.recommendationText,
    ).toBe('No answer was submitted for this question.');
  });

  it('ignores non-eligibility skip reasons', () => {
    expect(
      buildSkipTemplateTexts('missing_question', questionText, 'en'),
    ).toBeNull();
    expect(isQuestionFeedbackEligibilitySkipReason('locked')).toBe(false);
  });
});
