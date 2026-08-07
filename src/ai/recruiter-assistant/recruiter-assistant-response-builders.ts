import { QueryQuestionsDto } from '../../question/dto/query-questions.dto';
import {
  RecruiterAssistantCreatedQuestionDto,
  RecruiterAssistantRedirectDto,
} from './dto/recruiter-assistant.dto';

export function buildCreatedQuestionCard(input: {
  id: string;
  questionText: string;
}): RecruiterAssistantCreatedQuestionDto {
  return {
    id: input.id,
    questionText: input.questionText,
    href: `/questions/${input.id}`,
  };
}

export function buildInterviewRedirect(input: {
  candidateName?: string;
  position?: string;
}): RecruiterAssistantRedirectDto {
  const query: Record<string, string> = {};
  if (input.candidateName) {
    query.candidateName = input.candidateName;
  }
  if (input.position) {
    query.position = input.position;
  }
  return {
    path: '/interviews/new',
    query: Object.keys(query).length > 0 ? query : undefined,
  };
}

export function buildInterviewCardHref(interviewId: string): string {
  return `/interviews/${interviewId}`;
}

/** Maps assistant question filters to frontend /questions query params (GET /questions fields only). */
export function buildQuestionsListRedirect(
  filters: QueryQuestionsDto,
): RecruiterAssistantRedirectDto {
  const query: Record<string, string> = {};

  if (filters.q) {
    query.q = filters.q;
  }
  if (filters.difficulty) {
    query.difficulty = filters.difficulty;
  }
  if (filters.category) {
    query.category = filters.category;
  }
  if (filters.subcategory) {
    query.subcategory = filters.subcategory;
  }
  if (filters.role) {
    query.role = filters.role;
  }
  if (filters.primaryLocale) {
    query.primaryLocale = filters.primaryLocale;
  }
  if (filters.locale) {
    query.locale = filters.locale;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.sortBy) {
    query.sortBy = filters.sortBy;
  }
  if (filters.sortOrder) {
    query.sortOrder = filters.sortOrder;
  }
  if (filters.page != null) {
    query.page = String(filters.page);
  }
  if (filters.tags?.length) {
    query.tags = filters.tags.join(',');
  }
  if (filters.eligibleForInterview === true) {
    query.eligibleForInterview = 'true';
  }

  return {
    path: '/questions',
    query: Object.keys(query).length > 0 ? query : undefined,
  };
}
