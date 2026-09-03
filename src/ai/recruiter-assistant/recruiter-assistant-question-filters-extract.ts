import {
  QueryQuestionsDto,
  QUESTION_STATUS_VALUES,
} from '../../question/dto/query-questions.dto';
import { QuestionDifficulty } from '../../question/interfaces/question.interface';
import {
  extractQuestionLocaleFilter,
  resolveLocaleToken,
} from './recruiter-assistant-locale-extract';
import { extractPositionFromMessage } from './recruiter-assistant-request-parser';
import { trimField } from './recruiter-assistant-string-utils';

const QUOTED_TEXT = /[""](.+?)[""]/;
const DIFFICULTY_PATTERN = /\b(easy|medium|hard)\b/i;
const STATUS_PATTERN = /\b(active|inactive|scheduled|all)\b/i;
const ROLE_FOR_PATTERN =
  /\bquestions?\s+for\s+(?:a\s+)?(.+?)(?:[.?!]|$)|(?:вопрос(?:ы|)?|pytani(?:a|e|ń)?|pyta[nń]|пытанн(?:е|і|я)?)\s+(?:for|для|dla)\s+(?:a\s+)?(.+?)(?:[.?!]|$)/iu;
const CATEGORY_PATTERN =
  /\b(?:in\s+)?categor(?:y|ies)\s+(?:is\s+)?(.+?)(?:[.?!]|$)|(?:категори(?:я|и)|kategori(?:a|i))\s+(?:is\s+|равна\s+|to\s+)?(.+?)(?:[.?!]|$)/iu;
const SUBCATEGORY_PATTERN =
  /\b(?:subcategory|sub-category|type)\s+(?:is\s+)?(.+?)(?:[.?!]|$)|(?:подкатегори(?:я|и)|typ(?:u)?)\s+(?:is\s+|равна\s+|to\s+)?(.+?)(?:[.?!]|$)/iu;
const TAGS_PATTERN = /\btags?(?:ged)?\s+([a-z0-9,_-]+)/i;
const CONTAINING_PATTERN =
  /\b(?:containing|содержа(?:щ|)|змесцив|zawieraj[aą]c(?:e|y)?)\s+(.+?)(?:[.?!]|$)/iu;
const IMPLICIT_CATEGORY_PATTERN =
  /\b([a-z0-9_-]+)\s+(?:questions?|вопрос(?:ы|)?|pytani(?:a|e|ń)?|pyta[nń]|пытанн(?:е|і|я)?)\b/giu;

const DIFFICULTIES = new Set<QuestionDifficulty>(['easy', 'medium', 'hard']);
const STATUSES = new Set<string>(QUESTION_STATUS_VALUES);
const IMPLICIT_CATEGORY_STOP_WORDS = new Set([
  'how',
  'many',
  'all',
  'the',
  'some',
  'any',
  'my',
  'our',
  'your',
  'show',
  'list',
  'count',
  'total',
  'display',
  'find',
  'browse',
  'inactive',
  'active',
  'scheduled',
  'eligible',
  'tagged',
  'containing',
  'in',
  'with',
  'for',
  'where',
  'filtered',
  'matching',
  'type',
  'category',
  'subcategory',
  'pytania',
  'pytan',
  'pytań',
  'вопрос',
  'вопросы',
  'пытанне',
  'пытанні',
  'пытання',
]);
const NON_CATEGORY_ADJECTIVES = new Set([
  'expert',
  'beginner',
  'advanced',
  'intermediate',
  'senior',
  'junior',
]);

function parseTags(raw: string | undefined): string[] | undefined {
  if (!raw) {
    return undefined;
  }
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
  return tags.length > 0 ? tags : undefined;
}

function matchFirstCaptureGroup(
  pattern: RegExp,
  message: string,
): string | undefined {
  const match = message.match(pattern);
  if (!match) {
    return undefined;
  }
  for (let index = 1; index < match.length; index += 1) {
    if (match[index]) {
      return match[index];
    }
  }
  return undefined;
}

function extractImplicitCategory(message: string): string | undefined {
  for (const match of message.matchAll(IMPLICIT_CATEGORY_PATTERN)) {
    const raw = match[1];
    if (!raw) {
      continue;
    }
    const token = raw.toLowerCase();
    if (
      DIFFICULTIES.has(token as QuestionDifficulty) ||
      STATUSES.has(token) ||
      IMPLICIT_CATEGORY_STOP_WORDS.has(token) ||
      NON_CATEGORY_ADJECTIVES.has(token) ||
      resolveLocaleToken(token)
    ) {
      continue;
    }
    return trimField(raw, 120);
  }
  return undefined;
}

export function extractQuestionFilters(message: string): QueryQuestionsDto {
  const filters: QueryQuestionsDto = {};

  const difficulty = message.match(DIFFICULTY_PATTERN)?.[1]?.toLowerCase();
  if (difficulty && DIFFICULTIES.has(difficulty as QuestionDifficulty)) {
    filters.difficulty = difficulty as QuestionDifficulty;
  }

  const status = message.match(STATUS_PATTERN)?.[1]?.toLowerCase();
  if (status && STATUSES.has(status)) {
    filters.status = status as QueryQuestionsDto['status'];
  }

  const roleFor = trimField(
    matchFirstCaptureGroup(ROLE_FOR_PATTERN, message),
    120,
  );
  const roleKeyword = extractPositionFromMessage(message);
  const role = roleFor ?? roleKeyword;
  if (role) {
    filters.role = role;
  }

  const category = trimField(
    matchFirstCaptureGroup(CATEGORY_PATTERN, message),
    120,
  );
  if (category) {
    filters.category = category;
  } else if (!role) {
    const implicitCategory = extractImplicitCategory(message);
    if (implicitCategory) {
      filters.category = implicitCategory;
    }
  }

  const subcategory = trimField(
    matchFirstCaptureGroup(SUBCATEGORY_PATTERN, message),
    120,
  );
  if (subcategory) {
    filters.subcategory = subcategory;
  }

  const tags = parseTags(message.match(TAGS_PATTERN)?.[1]);
  if (tags) {
    filters.tags = tags;
  }

  const quoted = trimField(message.match(QUOTED_TEXT)?.[1], 200);
  const containing = trimField(message.match(CONTAINING_PATTERN)?.[1], 200);
  const q = quoted ?? containing;
  if (q) {
    filters.q = q;
  }

  const locale = extractQuestionLocaleFilter(message);
  if (locale) {
    filters.locale = locale;
  }

  if (/\beligible for interview\b/i.test(message)) {
    filters.eligibleForInterview = true;
  }

  return filters;
}
