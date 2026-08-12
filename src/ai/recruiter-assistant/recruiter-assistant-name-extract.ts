const PERSON_NAME = `[\\p{L}'][\\p{L}'-]*(?:\\s+[\\p{L}'][\\p{L}'-]*){0,2}`;

const ROLE_TITLE_WORDS = new Set([
  'a',
  'an',
  'architect',
  'analyst',
  'backend',
  'designer',
  'developer',
  'devops',
  'engineer',
  'frontend',
  'fullstack',
  'full-stack',
  'intern',
  'junior',
  'lead',
  'manager',
  'qa',
  'react',
  'role',
  'senior',
  'software',
  'staff',
  'test',
  'разработчик',
  'инженер',
  'тест',
  'фронтенд',
  'бэкенд',
  'фулст',
]);

const NAME_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'about',
  'candidate',
  'for',
  'hr',
  'interview',
  'interviews',
  'or',
  'please',
  'reviewer',
  'role',
  'the',
  'to',
]);

const INTERVIEW_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

const HR_UUID =
  /hr\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;

function sanitizeExtractedName(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter((token) => !NAME_STOP_WORDS.has(token.toLowerCase()));

  if (tokens.length === 0) {
    return undefined;
  }

  return tokens.join(' ');
}

function looksLikePersonName(value: string): boolean {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return false;
  }

  if (tokens.some((token) => ROLE_TITLE_WORDS.has(token.toLowerCase()))) {
    return false;
  }

  return true;
}

function firstCapture(message: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const sanitized = sanitizeExtractedName(match[1]);
      if (sanitized && looksLikePersonName(sanitized)) {
        return sanitized;
      }
    }
  }
  return undefined;
}

function firstCaptureAllowRole(
  message: string,
  patterns: RegExp[],
): string | undefined {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const sanitized = sanitizeExtractedName(match[1]);
      if (sanitized) {
        return sanitized;
      }
    }
  }
  return undefined;
}

export function extractInterviewCandidateName(
  message: string,
): string | undefined {
  return firstCaptureAllowRole(message, [
    new RegExp(
      `\\bassign\\b(?:.*?)\\binterview\\b\\s+for\\s+(${PERSON_NAME})\\s+to\\b`,
      'iu',
    ),
    new RegExp(
      `\\bassign\\b(?:\\s+\\w+){0,4}\\s+(?:interview\\s+)?for\\s+(${PERSON_NAME})\\s+to\\b`,
      'iu',
    ),
    new RegExp(`\\binterview\\s+(?:for|of|about)\\s+(${PERSON_NAME})\\b`, 'iu'),
    new RegExp(`\\bcandidate\\s+(?!email\\b)(${PERSON_NAME})\\b`, 'iu'),
    new RegExp(
      `\\b(?:status|review(?:ed)?|review state)\\s+(?:of|for)\\s+(${PERSON_NAME})\\b`,
      'iu',
    ),
  ]);
}

export function extractInterviewId(message: string): string | undefined {
  return message.match(INTERVIEW_UUID)?.[0];
}

export function extractHrUserName(message: string): string | undefined {
  return firstCaptureAllowRole(message, [
    new RegExp(`\\bassign\\b.*?\\bto\\s+(${PERSON_NAME})\\b`, 'iu'),
    new RegExp(`\\b(?:reviewer|hr)\\s+(${PERSON_NAME})\\b`, 'iu'),
  ]);
}

export function extractHrUserId(message: string): string | undefined {
  return message.match(HR_UUID)?.[1];
}

export function extractCandidateNameFromCreateRequest(
  message: string,
): string | undefined {
  return firstCapture(message, [
    new RegExp(`\\binterview\\s+for\\s+(${PERSON_NAME})\\s+for\\b`, 'iu'),
    new RegExp(`\\binterview\\s+for\\s+(${PERSON_NAME})\\b`, 'iu'),
    new RegExp(`\\bcandidate\\s+(?!email\\b)(${PERSON_NAME})\\b`, 'iu'),
    new RegExp(
      `\\b(?:for|кандидат(?:а|у)?|для кандидата)\\s+(${PERSON_NAME})\\b`,
      'iu',
    ),
  ]);
}
