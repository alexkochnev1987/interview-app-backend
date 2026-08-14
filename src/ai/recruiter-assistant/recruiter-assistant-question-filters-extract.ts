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

const QUOTED_TEXT = /[""](.+?)[""]/;
const DIFFICULTY_PATTERN = /\b(easy|medium|hard)\b/i;
const STATUS_PATTERN = /\b(active|inactive|scheduled|all)\b/i;
const ROLE_FOR_PATTERN = /\bquestions?\s+for\s+(?:a\s+)?(.+?)(?:[.?!]|$)/i;
const CATEGORY_PATTERN =
  /\b(?:in\s+)?categor(?:y|ies)\s+(?:is\s+)?(.+?)(?:[.?!]|$)/i;
const SUBCATEGORY_PATTERN =
  /\b(?:subcategory|sub-category|type)\s+(?:is\s+)?(.+?)(?:[.?!]|$)/i;
const TAGS_PATTERN = /\btags?(?:ged)?\s+([a-z0-9,_-]+)/i;
const CONTAINING_PATTERN = /\bcontaining\s+(.+?)(?:[.?!]|$)/i;
const IMPLICIT_CATEGORY_PATTERN = /\b([a-z0-9_-]+)\s+questions?\b/gi;

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
]);
const NON_CATEGORY_ADJECTIVES = new Set([
  'expert',
  'beginner',
  'advanced',
  'intermediate',
  'senior',
  'junior',
]);

function trimField(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value
    .trim()
    .replace(/[.?!]+$/, '')
    .slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : undefined;
}

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

  const roleFor = trimField(message.match(ROLE_FOR_PATTERN)?.[1], 120);
  const roleKeyword = extractPositionFromMessage(message);
  const role = roleFor ?? roleKeyword;
  if (role) {
    filters.role = role;
  }

  const category = trimField(message.match(CATEGORY_PATTERN)?.[1], 120);
  if (category) {
    filters.category = category;
  } else if (!role) {
    const implicitCategory = extractImplicitCategory(message);
    if (implicitCategory) {
      filters.category = implicitCategory;
    }
  }

  const subcategory = trimField(message.match(SUBCATEGORY_PATTERN)?.[1], 120);
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
