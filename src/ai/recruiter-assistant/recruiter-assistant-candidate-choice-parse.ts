import {
  isCancellationMessage,
  isConfirmationMessage,
} from './recruiter-assistant.policy';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NEW_CANDIDATE_PATTERN = /\bnew\s+candidate\b/i;

export type CandidateChoice =
  | { kind: 'registered'; id: string }
  | { kind: 'new'; name: string };

export type RegisteredCandidateConfirmation = 'yes' | 'no';

export function parseCandidateChoice(message: string): CandidateChoice | null {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  if (UUID_PATTERN.test(trimmed)) {
    return { kind: 'registered', id: trimmed };
  }

  if (NEW_CANDIDATE_PATTERN.test(trimmed)) {
    return null;
  }

  return { kind: 'new', name: trimmed };
}

export function parseRegisteredCandidateConfirmation(
  message: string,
): RegisteredCandidateConfirmation | null {
  if (isConfirmationMessage(message)) {
    return 'yes';
  }
  if (isCancellationMessage(message)) {
    return 'no';
  }
  return null;
}
