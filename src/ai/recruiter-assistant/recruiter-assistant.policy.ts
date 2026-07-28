import { hasEffectivePermission } from '../../auth/permissions';
import { ActingUser } from './recruiter-assistant.types';

export const OUT_OF_SCOPE_RESPONSE =
  'I can help with your interviews, status, assignments, and question setup inside this app. Try asking about your interviews, an interview status, or preparing questions.';

const CONFIRMATION_KEYWORDS = [
  'yes',
  'y',
  'confirm',
  'do it',
  'ok',
  'okay',
  'да',
  'ага',
  'подтверждаю',
  'создай',
  'создавай',
];

export function isConfirmationMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return CONFIRMATION_KEYWORDS.some(
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
