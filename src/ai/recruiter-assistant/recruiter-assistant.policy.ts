import { hasEffectivePermission } from '../../auth/permissions';
import { ActingUser } from './recruiter-assistant.types';

export const OUT_OF_SCOPE_RESPONSE =
  'I can help with interviews, question banks, candidates, assessments, templates, and feedback inside this app. Try asking me to prepare interview questions or create an interview.';

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

const APP_RELATED_KEYWORDS = [
  'interview',
  'question',
  'candidate',
  'assessment',
  'feedback',
  'template',
  'интерв',
  'вопрос',
  'кандидат',
  'оцен',
  'фидбек',
  'шаблон',
  'разработчик',
  'developer',
];

export function isConfirmationMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return CONFIRMATION_KEYWORDS.some(
    (value) => normalized === value || normalized.startsWith(`${value} `),
  );
}

export function isRecruiterAssistantScope(message: string): boolean {
  const normalized = message.toLowerCase();
  return APP_RELATED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function canCreateQuestions(user: ActingUser): boolean {
  return hasEffectivePermission(user.role, user.demo, 'questions:create');
}

export function canCreateInterviews(user: ActingUser): boolean {
  return hasEffectivePermission(user.role, user.demo, 'interviews:create');
}
