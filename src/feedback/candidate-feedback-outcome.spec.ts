import { BadRequestException } from '@nestjs/common';
import { resolveCandidateFeedbackOutcomePatch } from './candidate-feedback-outcome';

describe('resolveCandidateFeedbackOutcomePatch', () => {
  it('returns null when patch has no outcome fields', () => {
    expect(
      resolveCandidateFeedbackOutcomePatch(
        { outcome: 'next_stage' },
        {},
      ),
    ).toBeNull();
  });

  it('clears outcome and message when outcome is null', () => {
    expect(
      resolveCandidateFeedbackOutcomePatch(
        {
          outcome: 'custom',
          outcomeMessage: 'Old custom text',
        },
        { outcome: null },
      ),
    ).toEqual({ outcome: null, outcomeMessage: null });
  });

  it('clears custom message when switching to a preset', () => {
    expect(
      resolveCandidateFeedbackOutcomePatch(
        {
          outcome: 'custom',
          outcomeMessage: 'Old custom text',
        },
        { outcome: 'next_stage', outcomeMessage: 'ignored' },
      ),
    ).toEqual({ outcome: 'next_stage', outcomeMessage: null });
  });

  it('requires non-empty message for custom outcome', () => {
    expect(() =>
      resolveCandidateFeedbackOutcomePatch({}, { outcome: 'custom' }),
    ).toThrow(BadRequestException);

    expect(() =>
      resolveCandidateFeedbackOutcomePatch(
        {},
        { outcome: 'custom', outcomeMessage: '   ' },
      ),
    ).toThrow(/non-empty outcomeMessage/i);
  });

  it('stores trimmed custom message', () => {
    expect(
      resolveCandidateFeedbackOutcomePatch(
        {},
        {
          outcome: 'custom',
          outcomeMessage: '  Keep in touch with details.  ',
        },
      ),
    ).toEqual({
      outcome: 'custom',
      outcomeMessage: 'Keep in touch with details.',
    });
  });

  it('keeps existing custom message when only outcome custom is resent', () => {
    expect(
      resolveCandidateFeedbackOutcomePatch(
        {
          outcome: 'custom',
          outcomeMessage: 'Existing message',
        },
        { outcome: 'custom' },
      ),
    ).toEqual({
      outcome: 'custom',
      outcomeMessage: 'Existing message',
    });
  });

  it('ignores message-only patch when current outcome is a preset', () => {
    expect(
      resolveCandidateFeedbackOutcomePatch(
        { outcome: 'keep_in_touch' },
        { outcomeMessage: 'Should be ignored' },
      ),
    ).toBeNull();
  });

  it('updates message when current outcome is custom', () => {
    expect(
      resolveCandidateFeedbackOutcomePatch(
        {
          outcome: 'custom',
          outcomeMessage: 'Old',
        },
        { outcomeMessage: 'Updated custom text' },
      ),
    ).toEqual({
      outcome: 'custom',
      outcomeMessage: 'Updated custom text',
    });
  });
});
