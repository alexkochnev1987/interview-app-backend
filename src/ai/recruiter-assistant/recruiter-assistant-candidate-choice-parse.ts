import {
  isCancellationMessage,
  isConfirmationMessage,
} from './recruiter-assistant.policy';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NEW_CANDIDATE_PATTERNS = [
  /^new\s+candidate$/i,
  /^нов(?:ый|ая|ое|ы)\s+кан(?:дидат|дыдат)$/iu,
  /^nowy\s+kandydat$/iu,
];

export type CandidateChoice =
  | { kind: 'registered'; id: string }
  | { kind: 'new'; name: string };

export type RegisteredCandidateConfirmation = 'yes' | 'no';

function isNewCandidatePhrase(message: string): boolean {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, ' ');
  return NEW_CANDIDATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function parseCandidateChoice(message: string): CandidateChoice | null {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  if (UUID_PATTERN.test(trimmed)) {
    return { kind: 'registered', id: trimmed };
  }

  if (isNewCandidatePhrase(trimmed)) {
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
