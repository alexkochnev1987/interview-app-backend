import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest } from '../common/errors/api-error';
import { CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH } from './candidate-feedback-block-rules';
import {
  CandidateFeedbackOutcome,
  isCandidateFeedbackPresetOutcome,
} from './interfaces/candidate-feedback.interface';

export type CandidateFeedbackOutcomeState = {
  outcome?: CandidateFeedbackOutcome;
  outcomeMessage?: string;
};

export type CandidateFeedbackOutcomePatch = {
  outcome?: CandidateFeedbackOutcome | null;
  outcomeMessage?: string | null;
};

export type ResolvedCandidateFeedbackOutcome = {
  outcome: CandidateFeedbackOutcome | null;
  outcomeMessage: string | null;
};

function normalizeOutcomeMessage(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function assertCustomOutcomeMessage(
  message: string,
  context: { interviewId?: string } = {},
): string {
  if (!message) {
    throw apiBadRequest(
      ApiErrorCode.BAD_REQUEST,
      'Custom candidate-feedback outcome requires a non-empty outcomeMessage',
      context,
    );
  }

  if (message.length > CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH) {
    throw apiBadRequest(
      ApiErrorCode.VALIDATION_ERROR,
      `outcomeMessage must be at most ${CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH} characters`,
      context,
    );
  }

  return message;
}

/**
 * Resolves outcome + message for an HR patch.
 * - null outcome clears both
 * - presets clear/ignore message
 * - custom requires a non-empty trimmed message (from patch or existing)
 * - message-only patch applies only when current outcome is custom
 */
export function resolveCandidateFeedbackOutcomePatch(
  existing: CandidateFeedbackOutcomeState,
  patch: CandidateFeedbackOutcomePatch,
  context: { interviewId?: string } = {},
): ResolvedCandidateFeedbackOutcome | null {
  if (patch.outcome === undefined && patch.outcomeMessage === undefined) {
    return null;
  }

  if (patch.outcome === null) {
    return { outcome: null, outcomeMessage: null };
  }

  if (patch.outcome !== undefined) {
    if (isCandidateFeedbackPresetOutcome(patch.outcome)) {
      return { outcome: patch.outcome, outcomeMessage: null };
    }

    const message = assertCustomOutcomeMessage(
      normalizeOutcomeMessage(
        patch.outcomeMessage !== undefined
          ? patch.outcomeMessage
          : existing.outcomeMessage,
      ),
      context,
    );
    return { outcome: 'custom', outcomeMessage: message };
  }

  // Message-only update.
  if (existing.outcome == null) {
    throw apiBadRequest(
      ApiErrorCode.BAD_REQUEST,
      'outcomeMessage requires outcome to be set to custom',
      context,
    );
  }

  if (isCandidateFeedbackPresetOutcome(existing.outcome)) {
    // Presets ignore custom message text.
    return null;
  }

  const message = assertCustomOutcomeMessage(
    normalizeOutcomeMessage(patch.outcomeMessage),
    context,
  );
  return { outcome: 'custom', outcomeMessage: message };
}
