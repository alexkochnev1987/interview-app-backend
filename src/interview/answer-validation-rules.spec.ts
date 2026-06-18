import { getAnswerValidationSubmissionBlockReason } from './answer-validation-rules';

describe('answer-validation-rules', () => {
  it('requires an existing answer', () => {
    expect(getAnswerValidationSubmissionBlockReason(0, undefined)).toBe(
      'Answer for question 0 is not available',
    );
  });

  it('requires submitted status before validation', () => {
    expect(
      getAnswerValidationSubmissionBlockReason(1, { status: 'recording' }),
    ).toBe('Question 1 must be submitted before validation starts');
    expect(
      getAnswerValidationSubmissionBlockReason(1, { status: 'submitted' }),
    ).toBeNull();
  });
});
