import { hasEffectivePermission } from '../../auth/permissions';
import { ActingUser } from './recruiter-assistant.types';

export const OUT_OF_SCOPE_RESPONSE =
  'I can help with interviews, question counts, assessments, team members, activity summaries, assignments, and question setup inside this app.';

export const RECRUITER_ASSISTANT_DISABLED_RESPONSE =
  'Recruiter assistant is disabled in this environment.';

export const NEW_CHAT_WELCOME_RESPONSE =
  'Started a new conversation. How can I help with interviews, questions, or assignments?';

const CONFIRMATION_KEYWORDS = [
  'yes',
  'y',
  'confirm',
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
  'stop',
  'нет',
  'отмена',
  'отменить',
];

export function isConfirmationMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return CONFIRMATION_KEYWORDS.includes(normalized);
}

export function isCancellationMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return CANCELLATION_KEYWORDS.some(
    (value) => normalized === value || normalized.startsWith(`${value} `),
  );
}

export function canAccessChat(user: ActingUser): boolean {
  return (
    user.role === 'super_admin'
    || user.role === 'admin'
    || user.role === 'hr'
    || user.role === 'candidate'
  );
}

export function canListInterviews(user: ActingUser): boolean {
  return (
    user.role === 'super_admin'
    || user.role === 'admin'
    || user.role === 'hr'
  );
}

export function canAssignHr(user: ActingUser): boolean {
  return (
    (user.role === 'super_admin' || user.role === 'admin')
    && hasEffectivePermission(user.role, user.demo, 'interviews:assign')
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

export function canReadTemplates(user: ActingUser): boolean {
  return hasEffectivePermission(user.role, user.demo, 'templates:read');
}

export function canListTeam(user: ActingUser): boolean {
  return hasEffectivePermission(user.role, user.demo, 'users:read');
}
