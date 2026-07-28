import { Locale } from '../../locale/locale.constants';
import { extractCandidateNameFromCreateRequest } from './recruiter-assistant-name-extract';
import { ParsedRecruiterRequest } from './recruiter-assistant.types';

export function parseRecruiterRequest(
  message: string,
  locale: Locale,
): ParsedRecruiterRequest {
  const countMatch = message.match(/\b(\d{1,2})\b/);
  const count = Math.min(Math.max(Number(countMatch?.[1] ?? 10), 1), 12);
  const candidateEmail = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];

  return {
    position: extractPosition(message),
    count,
    candidateName: extractCandidateName(message),
    candidateEmail,
    locale,
  };
}

function extractCandidateName(message: string): string | undefined {
  return extractCandidateNameFromCreateRequest(message);
}

function extractPosition(message: string): string {
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
  return 'Software Developer';
}
