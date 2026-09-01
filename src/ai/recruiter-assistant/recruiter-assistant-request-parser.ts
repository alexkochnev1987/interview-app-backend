import { Locale } from '../../locale/locale.constants';
import { extractCandidateNameFromCreateRequest } from './recruiter-assistant-name-extract';
import { ParsedRecruiterRequest } from './recruiter-assistant.types';

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const QUESTION_COUNT_PATTERNS = [
  /\b(\d{1,2})\s+questions?\b/i,
  /\bquestions?\s+(?:count\s+)?(?:of\s+)?(\d{1,2})\b/i,
  /\b(?:generate|prepare|create|make|need|want)\s+(\d{1,2})\s+(?:questions?|вопрос|pytani|пытанн)/iu,
  /\b(\d{1,2})\s+(?:вопрос(?:а|ов)?|pytani(?:a|e|ń)?|pyta[nń]|пытанн(?:е|і|я))\b/iu,
];

const CANDIDATE_EMAIL_PATTERNS = [
  /\b(?:candidate\s+)?email\s*(?:is|:)\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  /\bcandidate\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  /\bfor\s+candidate\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
];

export function parseRecruiterRequest(
  message: string,
  locale: Locale,
): ParsedRecruiterRequest {
  return {
    position: extractPosition(message),
    count: extractQuestionCount(message),
    candidateName: extractCandidateName(message),
    candidateEmail: extractCandidateEmail(message),
    locale,
  };
}

export function extractQuestionCount(message: string): number {
  for (const pattern of QUESTION_COUNT_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return Math.min(Math.max(Number(match[1]), 1), 12);
    }
  }

  return 10;
}

export function extractCandidateEmail(message: string): string | undefined {
  for (const pattern of CANDIDATE_EMAIL_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1] && EMAIL_PATTERN.test(match[1])) {
      return match[1];
    }
  }

  return undefined;
}

function extractCandidateName(message: string): string | undefined {
  return extractCandidateNameFromCreateRequest(message);
}

function findExplicitPosition(message: string): string | undefined {
  const normalized = message.toLowerCase();
  if (normalized.includes('react')) return 'React Developer';
  if (normalized.includes('frontend') || normalized.includes('фронтенд')) {
    return 'Frontend Developer';
  }
  if (normalized.includes('backend') || normalized.includes('бэкенд')) {
    return 'Backend Developer';
  }
  if (normalized.includes('fullstack') || normalized.includes('фулст')) {
    return 'Full-stack Developer';
  }
  if (normalized.includes('qa') || normalized.includes('тест')) {
    return 'QA Engineer';
  }
  if (normalized.includes('devops')) return 'DevOps Engineer';
  if (/\bsoftware\s+(?:developer|engineer)\b/.test(normalized)) {
    return 'Software Developer';
  }
  return undefined;
}

function extractPosition(message: string): string {
  return findExplicitPosition(message) ?? 'Software Developer';
}

export function extractPositionFromMessage(
  message: string,
): string | undefined {
  return findExplicitPosition(message);
}
