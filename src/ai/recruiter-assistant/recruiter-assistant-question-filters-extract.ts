import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import {
  QueryQuestionsDto,
  QUESTION_STATUS_VALUES,
} from '../../question/dto/query-questions.dto';
import { QuestionDifficulty } from '../../question/interfaces/question.interface';
import { extractRequestedLocale } from './recruiter-assistant-locale-extract';
import { extractPositionFromMessage } from './recruiter-assistant-request-parser';

const QUOTED_TEXT = /[""](.+?)[""]/;
const DIFFICULTY_PATTERN = /\b(easy|medium|hard)\b/i;
const STATUS_PATTERN = /\b(active|inactive|scheduled|all)\b/i;
const ROLE_FOR_PATTERN = /\bquestions?\s+for\s+(?:a\s+)?(.+?)(?:[.?!]|$)/i;
const CATEGORY_PATTERN = /\bcategor(?:y|ies)\s+(.+?)(?:[.?!]|$)/i;
const SUBCATEGORY_PATTERN = /\b(?:subcategory|type)\s+(.+?)(?:[.?!]|$)/i;
const TAGS_PATTERN = /\btags?(?:ged)?\s+([a-z0-9,_-]+)/i;
const CONTAINING_PATTERN = /\bcontaining\s+(.+?)(?:[.?!]|$)/i;

const DIFFICULTIES = new Set<QuestionDifficulty>(['easy', 'medium', 'hard']);
const STATUSES = new Set<string>(QUESTION_STATUS_VALUES);

function trimField(value: string | undefined, maxLength: number): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().replace(/[.?!]+$/, '').slice(0, maxLength);
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

  const locale = extractRequestedLocale(message);
  if (locale && SUPPORTED_LOCALES.includes(locale)) {
    filters.locale = locale;
    filters.primaryLocale = locale;
  }

  if (/\beligible for interview\b/i.test(message)) {
    filters.eligibleForInterview = true;
  }

  return filters;
}
