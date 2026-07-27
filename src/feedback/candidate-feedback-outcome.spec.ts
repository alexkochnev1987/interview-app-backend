import { BadRequestException } from '@nestjs/common';
import { resolveCandidateFeedbackOutcomePatch } from './candidate-feedback-outcome';

describe('resolveCandidateFeedbackOutcomePatch', () => {
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

  it('requires and stores a trimmed message for custom outcome', () => {
    expect(() =>
      resolveCandidateFeedbackOutcomePatch({}, { outcome: 'custom' }),
    ).toThrow(BadRequestException);

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

  it('rejects message-only patches when outcome is missing or a preset', () => {
    expect(() =>
      resolveCandidateFeedbackOutcomePatch(
        {},
        { outcomeMessage: 'Orphan message' },
      ),
    ).toThrow(/outcomeMessage requires outcome to be set to custom/i);

    expect(() =>
      resolveCandidateFeedbackOutcomePatch(
        { outcome: 'next_stage' },
        { outcomeMessage: 'Orphan message' },
      ),
    ).toThrow(/outcomeMessage requires outcome to be set to custom/i);
  });
});
