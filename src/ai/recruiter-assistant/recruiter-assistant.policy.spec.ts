import {
  isCancellationMessage,
  isConfirmationMessage,
  isConversationResetMessage,
  isSimilarQuestionOverrideCancellation,
  isSimilarQuestionOverrideConfirmation,
  newChatWelcomeResponse,
  outOfScopeResponse,
} from './recruiter-assistant.policy';
import { ActingUser } from './recruiter-assistant.types';

describe('recruiter assistant confirmation messages', () => {
  it('recognizes exact confirmation replies only', () => {
    expect(isConfirmationMessage('yes')).toBe(true);
    expect(isConfirmationMessage('confirm')).toBe(true);
    expect(isConfirmationMessage('да')).toBe(true);
    expect(isConfirmationMessage('tak')).toBe(true);
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
    expect(isCancellationMessage('nie')).toBe(true);
  });

  it('recognizes similar-question override UI cancellation labels', () => {
    expect(
      isSimilarQuestionOverrideCancellation('no cancel creating the question'),
    ).toBe(true);
    expect(
      isSimilarQuestionOverrideCancellation('No, cancel creating the question'),
    ).toBe(true);
  });

  it('recognizes standalone cancel/abort as conversation reset', () => {
    expect(isConversationResetMessage('cancel')).toBe(true);
    expect(isConversationResetMessage('abort')).toBe(true);
    expect(isConversationResetMessage('Cancel.')).toBe(true);
    expect(isConversationResetMessage('no cancel creating the question')).toBe(
      false,
    );
  });

  it('recognizes localized cancellation replies', () => {
    expect(isCancellationMessage('anuluj')).toBe(true);
    expect(isCancellationMessage('отмена')).toBe(true);
    expect(isCancellationMessage('nie')).toBe(true);
  });
});

describe('role-aware assistant copy', () => {
  const candidate: ActingUser = {
    id: 'candidate-1',
    role: 'candidate',
    demo: false,
    email: 'candidate@example.com',
    name: 'Alice',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none',
    hasGoogleAvatar: false,
  };
  const admin: ActingUser = {
    id: 'admin-1',
    role: 'admin',
    demo: false,
    email: 'admin@example.com',
    name: 'Admin',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none',
    hasGoogleAvatar: false,
  };

  it('returns candidate-specific out-of-scope guidance', () => {
    expect(outOfScopeResponse(candidate)).toContain('interview status');
    expect(outOfScopeResponse(admin)).toContain('question counts');
  });

  it('returns candidate-specific new chat welcome text', () => {
    expect(newChatWelcomeResponse(candidate)).toContain('feedback is ready');
    expect(newChatWelcomeResponse(admin)).toContain('assignments');
  });
});
