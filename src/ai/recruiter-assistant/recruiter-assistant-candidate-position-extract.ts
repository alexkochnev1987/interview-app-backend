import { extractPositionFromMessage } from './recruiter-assistant-request-parser';

const LATEST_QUALIFIER_PATTERN =
  /\b(latest|most recent|newest|last|последн(?:его|ее|ий|ем)|сам(?:ый|ая|ое)\s+нов(?:ый|ая|ое))\b/i;

const MY_INTERVIEW_POSITION_PATTERN = /\bmy\s+(.+?)\s+interview\b/i;

function cleanPositionSegment(segment: string): string | undefined {
  const cleaned = segment
    .replace(/\bposition\b/gi, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
  return cleaned || undefined;
}

/** Pulls a role/position phrase from candidate self-service interview queries. */
export function extractCandidateInterviewPosition(
  message: string,
): string | undefined {
  const keywordPosition = extractPositionFromMessage(message);
  const myInterviewMatch = message.match(MY_INTERVIEW_POSITION_PATTERN);
  if (myInterviewMatch?.[1]) {
    const segment = myInterviewMatch[1].trim();
    if (segment && !LATEST_QUALIFIER_PATTERN.test(segment)) {
      const cleaned = cleanPositionSegment(segment);
      if (cleaned) {
        return keywordPosition ?? cleaned;
      }
    }
  }

  return keywordPosition;
}

export function isCandidateLatestInterviewQuery(message: string): boolean {
  return LATEST_QUALIFIER_PATTERN.test(message);
}
