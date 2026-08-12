import {
  isCancellationMessage,
  isConfirmationMessage,
  isSimilarQuestionOverrideCancellation,
  isSimilarQuestionOverrideConfirmation,
} from './recruiter-assistant.policy';

describe('recruiter assistant confirmation messages', () => {
  it('recognizes exact confirmation replies only', () => {
    expect(isConfirmationMessage('yes')).toBe(true);
    expect(isConfirmationMessage('confirm')).toBe(true);
    expect(isConfirmationMessage('да')).toBe(true);
  });

  it('does not treat prefixed or create phrasing as confirmation', () => {
    expect(isConfirmationMessage('ok now show me unassigned')).toBe(false);
    expect(isConfirmationMessage('создай 5 вопросов для React')).toBe(false);
    expect(isConfirmationMessage('ok')).toBe(false);
  });

  it('recognizes similar-question override UI confirmation labels', () => {
    expect(
      isSimilarQuestionOverrideConfirmation('yes create the question anyway'),
    ).toBe(true);
    expect(isSimilarQuestionOverrideConfirmation('Yes, create anyway')).toBe(
      true,
    );
  });

  it('recognizes cancellation replies', () => {
    expect(isCancellationMessage('no')).toBe(true);
    expect(isCancellationMessage('cancel')).toBe(true);
    expect(isCancellationMessage('never mind')).toBe(true);
  });

  it('recognizes similar-question override UI cancellation labels', () => {
    expect(
      isSimilarQuestionOverrideCancellation('no cancel creating the question'),
    ).toBe(true);
    expect(
      isSimilarQuestionOverrideCancellation('No, cancel creating the question'),
    ).toBe(true);
  });
});
