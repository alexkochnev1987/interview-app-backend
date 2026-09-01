import {
  ASSESSMENT_REVIEW_STATUS_VALUES,
  AssessmentReviewStatusFilter,
} from './recruiter-assistant-assessment-status';
import { trimField } from './recruiter-assistant-string-utils';

const QUOTED_TEXT = /[""](.+?)[""]/;
const STATUS_PATTERN =
  /\b(?:status\s+(?:is\s+)?|with\s+status\s+|статус\s+(?:равен\s+)?|status\s+(?:to\s+)?|status\s+(?:jest\s+)?|статус\s+(?:гэта\s+)?)(ready_to_score|ready|scoring|failed|all)\b/iu;
const STATUS_BEFORE_ASSESSMENTS =
  /\b(ready_to_score|ready|scoring|failed)\s+(?:assessments?|assesments?|assignments?)\b/i;
const CONTAINING_PATTERN =
  /\b(?:containing|содержа(?:щ|)|змесцив|zawieraj[aą]c(?:e|y)?)\s+(.+?)(?:[.?!]|$)/iu;
const IMPLICIT_SEARCH_PATTERN =
  /\b(?:show|list|find|count|display|покажи|список|сколько|пакажы|спіс|колькі|poka[żz]|lista|ile|znajd[źz]|wy[śs]wietl)\s+(.+?)\s+(?:assessments?|assesments?|assignments?)\b/iu;

const REVIEW_STATUSES = new Set<string>([
  ...ASSESSMENT_REVIEW_STATUS_VALUES,
  'all',
]);

function extractReviewStatus(
  message: string,
): AssessmentReviewStatusFilter | undefined {
  const explicit = message.match(STATUS_PATTERN)?.[1]?.toLowerCase();
  if (explicit && REVIEW_STATUSES.has(explicit)) {
    return explicit as AssessmentReviewStatusFilter;
  }

  const before = message.match(STATUS_BEFORE_ASSESSMENTS)?.[1]?.toLowerCase();
  if (before && REVIEW_STATUSES.has(before)) {
    return before as AssessmentReviewStatusFilter;
  }

  return undefined;
}

export interface QueryAssessmentsFilters {
  status?: AssessmentReviewStatusFilter;
  q?: string;
}

export function extractAssessmentFilters(
  message: string,
): QueryAssessmentsFilters {
  const filters: QueryAssessmentsFilters = {};

  const status = extractReviewStatus(message);
  if (status) {
    filters.status = status;
  }

  const quoted = trimField(message.match(QUOTED_TEXT)?.[1], 200);
  const containing = trimField(message.match(CONTAINING_PATTERN)?.[1], 200);
  let implicitSearch = trimField(
    message.match(IMPLICIT_SEARCH_PATTERN)?.[1],
    200,
  );

  if (implicitSearch) {
    const leadingStatus = implicitSearch.match(
      /^(ready_to_score|ready|scoring|failed)\b\s*(.*)$/i,
    );
    if (leadingStatus) {
      const parsedStatus = leadingStatus[1]?.toLowerCase();
      if (
        parsedStatus &&
        REVIEW_STATUSES.has(parsedStatus) &&
        parsedStatus !== 'all'
      ) {
        filters.status ??= parsedStatus as AssessmentReviewStatusFilter;
      }
      implicitSearch = trimField(leadingStatus[2], 200);
    }
  }

  const q = quoted ?? containing ?? implicitSearch;
  if (q) {
    const normalized = q.toLowerCase();
    if (
      !REVIEW_STATUSES.has(normalized) &&
      !/^(assessments?|assesments?|assignments?)$/i.test(normalized)
    ) {
      filters.q = q;
    }
  }

  return filters;
}
