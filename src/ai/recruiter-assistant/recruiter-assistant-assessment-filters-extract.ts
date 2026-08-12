import { extractPositionFromMessage } from './recruiter-assistant-request-parser';

const QUOTED_NAME = /[""](.+?)[""]/;
const NAME_PATTERNS = [
  /\b(?:assessments?|templates?)\s+(?:named|called|titled)\s+(.+?)(?:[.?!]|$)/i,
  /\b(?:named|called|titled)\s+(.+?)\s+(?:assessments?|templates?)\b/i,
  /\b(?:assessments?|templates?)\s+with\s+(?:name|title)\s+(.+?)(?:[.?!]|$)/i,
];
const POSITION_AFTER_FOR =
  /\b(?:assessments?|templates?)\s+for\s+(?:a\s+)?(.+?)(?:[.?!]|$)/i;

function messageWithoutExtractedName(
  message: string,
  nameContains?: string,
): string {
  if (!nameContains) {
    return message;
  }
  return message.replace(nameContains, ' ');
}

export function extractAssessmentFilters(message: string): {
  position?: string;
  nameContains?: string;
} {
  const filters: { position?: string; nameContains?: string } = {};

  const quoted = message.match(QUOTED_NAME)?.[1]?.trim();
  if (quoted) {
    filters.nameContains = quoted.slice(0, 200);
  } else {
    for (const pattern of NAME_PATTERNS) {
      const match = message.match(pattern);
      const value = match?.[1]?.trim();
      if (value) {
        filters.nameContains = value.replace(/[.?!]+$/, '').slice(0, 200);
        break;
      }
    }
  }

  const positionFromFor = message.match(POSITION_AFTER_FOR)?.[1]?.trim();
  if (positionFromFor) {
    filters.position = positionFromFor.replace(/[.?!]+$/, '').slice(0, 200);
  } else {
    const position = extractPositionFromMessage(
      messageWithoutExtractedName(message, filters.nameContains),
    );
    if (position) {
      filters.position = position;
    }
  }

  return filters;
}
