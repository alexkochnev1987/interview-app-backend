import { hasEffectivePermission } from '../../auth/permissions';
import { ActingUser } from './recruiter-assistant.types';

export const OUT_OF_SCOPE_RESPONSE =
  'I can help with your interviews, status, assignments, and question setup inside this app. Try asking about your interviews, an interview status, or preparing questions.';

export const RECRUITER_ASSISTANT_DISABLED_RESPONSE =
  'Recruiter assistant is disabled in this environment.';

export const RECRUITER_ASSISTANT_DISABLED_FOR_ROLE_RESPONSE =
  'Recruiter assistant is not available for your role in this environment.';

export function recruiterAssistantDisabledResponse(globalOff: boolean): string {
  return globalOff
    ? RECRUITER_ASSISTANT_DISABLED_RESPONSE
    : RECRUITER_ASSISTANT_DISABLED_FOR_ROLE_RESPONSE;
}

export const NEW_CHAT_WELCOME_RESPONSE =
  'Started a new conversation. How can I help with interviews, questions, or assignments?';

const CONFIRMATION_KEYWORDS = [
  'yes',
  'y',
  'confirm',
  'yup',
  'yeah',
  'do it',
  'да',
  'ага',
  'подтверждаю',
];

const CANCELLATION_KEYWORDS = [
  'no',
  'nope',
  'n',
  'cancel',
  'never mind',
  'nevermind',
  'abort',
  'stop',
  'нет',
  'отмена',
  'отменить',
];

export function normalizeAssistantDecisionMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .replace(/[,.!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isConfirmationMessage(message: string): boolean {
  const normalized = normalizeAssistantDecisionMessage(message);
  return CONFIRMATION_KEYWORDS.includes(normalized);
}

/** Accepts UI button labels like "yes create the question anyway". */
export function isSimilarQuestionOverrideConfirmation(
  message: string,
): boolean {
  const normalized = normalizeAssistantDecisionMessage(message);
  return CONFIRMATION_KEYWORDS.some(
    (value) => normalized === value || normalized.startsWith(`${value} `),
  );
}

export function isCancellationMessage(message: string): boolean {
  const normalized = normalizeAssistantDecisionMessage(message);
  return CANCELLATION_KEYWORDS.some(
    (value) => normalized === value || normalized.startsWith(`${value} `),
  );
}

/** Accepts UI button labels like "no cancel creating the question". */
export function isSimilarQuestionOverrideCancellation(
  message: string,
): boolean {
  return (
    isCancellationMessage(message) ||
    normalizeAssistantDecisionMessage(message).includes('cancel creating')
  );
}

export function canAccessChat(user: ActingUser): boolean {
  return (
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.role === 'hr' ||
    user.role === 'candidate'
  );
}

export function canListInterviews(user: ActingUser): boolean {
  return (
    user.role === 'super_admin' || user.role === 'admin' || user.role === 'hr'
  );
}

export function canAssignHr(user: ActingUser): boolean {
  return (
    (user.role === 'super_admin' || user.role === 'admin') &&
    hasEffectivePermission(user.role, user.demo, 'interviews:assign')
  );
}

export function canReadQuestions(user: ActingUser): boolean {
  return hasEffectivePermission(user.role, user.demo, 'questions:read');
}

export function canCreateQuestions(user: ActingUser): boolean {
  return hasEffectivePermission(user.role, user.demo, 'questions:create');
}

export function canCreateInterviews(user: ActingUser): boolean {
  return hasEffectivePermission(user.role, user.demo, 'interviews:create');
}
