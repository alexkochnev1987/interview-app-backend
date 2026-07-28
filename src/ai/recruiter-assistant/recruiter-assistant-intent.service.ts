import { Injectable } from '@nestjs/common';
import { Locale } from '../../locale/locale.constants';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { INTERVIEW_STATUSES } from '../../interview/interfaces/interview.interface';
import {
  extractHrUserId,
  extractHrUserName,
  extractInterviewCandidateName,
  extractInterviewId,
} from './recruiter-assistant-name-extract';
import { parseRecruiterRequest } from './recruiter-assistant-request-parser';
import {
  ActingUser,
  HrRef,
  InterviewRef,
  RecruiterAssistantIntent,
} from './recruiter-assistant.types';

const CREATE_INTENT_KEYWORDS = [
  'question',
  'questions',
  'prepare',
  'setup',
  'set up',
  'create interview',
  'create an interview',
  'make interview',
  'generate questions',
  'вопрос',
  'вопросы',
  'создай',
  'создать',
  'подготов',
  'интерв',
  'разработчик',
  'developer',
];

const ASSIGN_HR_PATTERNS = [
  /\bassign\b.*\b(to|hr|reviewer)\b/,
  /\bassign\b.*\bhr\b/,
  /\b(set|give)\b.*\b(reviewer|hr)\b/,
  /\bassign reviewer\b/,
  /\bназнач\b.*\b(hr|рекрут|reviewer|на)\b/,
];

const UNASSIGNED_PATTERNS = [
  /\bunassigned\b/,
  /\bno reviewer\b/,
  /\bwithout (an )?hr\b/,
  /\bне назначен/,
  /\bбез hr\b/,
];

const READY_FOR_REVIEW_PATTERNS = [
  /ready for (my )?review/,
  /\bawaiting review\b/,
  /\bneeds review\b/,
  /\bwaiting for (my )?review\b/,
  /\bготов.*к review\b/,
  /\bна review\b/,
];

const MY_INTERVIEWS_PATTERNS = [
  /\b(my interviews|show my interviews|list my interviews)\b/,
  /\binterviews assigned to me\b/,
  /\bмои интерв/,
];

const CANDIDATE_OWN_STATUS_PATTERNS = [
  /\b(do i have an interview|have i got an interview)\b/,
  /\bmy interview status\b/,
  /\bwhen is my interview\b/,
  /\bstatus of my interview\b/,
  /\bесть ли у меня интерв/,
  /\bмой интерв/,
];

const REVIEW_STATE_PATTERNS = [
  /\b(reviewed|been reviewed|review state|review status)\b/,
  /\bhas .+ been reviewed\b/,
  /\bdid .+ get reviewed\b/,
  /\bfeedback (shared|sent|published)\b/,
  /\bshare link\b/,
  /\bпросмотрен/,
  /\bревью\b/,
];

const INTERVIEW_STATUS_PATTERNS = [
  /\b(status of|status for|what is the status|what's the status)\b/,
  /\bhow is .+ doing\b/,
  /\bwhere is .+'s interview\b/,
  /\bis .+ (done|finished|complete)\b/,
  /\binterview status\b/,
  /\bстатус\b/,
];

const LIST_INTERVIEWS_PATTERNS = [
  /\b(show|list|get|find|display)\b.*\binterviews?\b/,
  /\binterviews?\b.*\b(show|list|pending|completed|failed|processing)\b/,
  /\b(all|open|active|pending|completed) interviews?\b/,
  /\binterviews by\b/,
  /\b(покажи|список|найди)\b.*\bинтерв/,
];

@Injectable()
export class RecruiterAssistantIntentService {
  classify(
    message: string,
    user: ActingUser,
    locale: Locale,
  ): RecruiterAssistantIntent {
    void locale;
    const normalized = message.toLowerCase().trim();

    if (this.matchesAny(normalized, ASSIGN_HR_PATTERNS)) {
      return {
        kind: 'assign_hr',
        interviewRef: this.extractInterviewRef(message),
        hrRef: this.extractHrRef(message),
      };
    }

    if (this.matchesAny(normalized, UNASSIGNED_PATTERNS)) {
      return { kind: 'list_unassigned' };
    }

    if (this.matchesAny(normalized, READY_FOR_REVIEW_PATTERNS)) {
      return {
        kind: 'list_interviews',
        filters: { status: 'completed', limit: 20 },
        readyForReview: true,
      };
    }

    if (this.matchesAny(normalized, MY_INTERVIEWS_PATTERNS)) {
      return { kind: 'list_interviews', filters: { limit: 20 } };
    }

    if (
      user.role === 'candidate'
      && this.matchesAny(normalized, CANDIDATE_OWN_STATUS_PATTERNS)
    ) {
      return { kind: 'interview_status', ref: {}, ownInterviews: true };
    }

    if (this.matchesAny(normalized, REVIEW_STATE_PATTERNS)) {
      return {
        kind: 'review_state',
        ref: this.extractInterviewRef(message),
      };
    }

    if (this.matchesAny(normalized, INTERVIEW_STATUS_PATTERNS)) {
      return {
        kind: 'interview_status',
        ref: this.extractInterviewRef(message),
      };
    }

    if (this.matchesAny(normalized, LIST_INTERVIEWS_PATTERNS)) {
      return {
        kind: 'list_interviews',
        filters: this.extractListFilters(normalized),
      };
    }

    if (this.matchesCreateIntent(normalized)) {
      return {
        kind: 'create_questions_interview',
        parsed: parseRecruiterRequest(message, locale),
      };
    }

    return { kind: 'out_of_scope' };
  }

  private matchesAny(normalized: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(normalized));
  }

  private matchesCreateIntent(normalized: string): boolean {
    return CREATE_INTENT_KEYWORDS.some((keyword) =>
      normalized.includes(keyword),
    );
  }

  private extractInterviewRef(message: string): InterviewRef {
    const interviewId = extractInterviewId(message);
    if (interviewId) {
      return { interviewId };
    }

    const candidateName = extractInterviewCandidateName(message);
    if (candidateName) {
      return { candidateName };
    }

    return {};
  }

  private extractHrRef(message: string): HrRef {
    const id = extractHrUserId(message);
    if (id) {
      return { id };
    }

    const name = extractHrUserName(message);
    if (name) {
      return { name };
    }

    return {};
  }

  private extractListFilters(normalized: string): QueryInterviewsDto {
    const filters: QueryInterviewsDto = { limit: 20 };

    for (const status of INTERVIEW_STATUSES) {
      if (
        normalized.includes(status.replace('_', ' '))
        || normalized.includes(status)
      ) {
        filters.status = status;
        break;
      }
    }

    return filters;
  }
}
