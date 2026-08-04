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
import {
  ASSIGN_HR_PATTERNS,
  CANDIDATE_OWN_STATUS_PATTERNS,
  CANDIDATE_SCHEDULE_PATTERNS,
  INTERVIEW_STATUS_PATTERNS,
  LIST_INTERVIEWS_PATTERNS,
  matchesAnyPattern,
  matchesCreateIntent,
  MY_INTERVIEWS_PATTERNS,
  READY_FOR_REVIEW_PATTERNS,
  REVIEW_STATE_PATTERNS,
  CREATE_SINGLE_QUESTION_PATTERNS,
  SWITCH_LOCALE_PATTERNS,
  NEW_CHAT_PATTERNS,
  UNASSIGNED_PATTERNS,
  matchesCreateSingleQuestionIntent,
} from './recruiter-assistant-intent-patterns';
import {
  extractLocaleToken,
  extractRequestedLocale,
} from './recruiter-assistant-locale-extract';
import { parseRecruiterRequest } from './recruiter-assistant-request-parser';
import {
  ActingUser,
  HrRef,
  InterviewRef,
  RecruiterAssistantIntent,
} from './recruiter-assistant.types';
import { extractQuestionName } from './recruiter-assistant-question-name-extract';

@Injectable()
export class RecruiterAssistantIntentService {
  classify(
    message: string,
    user: ActingUser,
    locale: Locale,
  ): RecruiterAssistantIntent {
    void locale;
    const normalized = message.toLowerCase().trim();

    if (matchesCreateIntent(normalized)) {
      return {
        kind: 'create_questions_interview',
        parsed: parseRecruiterRequest(message, locale),
      };
    }

    if (matchesCreateSingleQuestionIntent(normalized)) {
      return {
        kind: 'create_question',
        questionName: extractQuestionName(message),
      };
    }

    if (matchesAnyPattern(normalized, SWITCH_LOCALE_PATTERNS)) {
      const requestedLocale = extractRequestedLocale(message);
      return {
        kind: 'switch_locale',
        requestedLocale,
        rawToken: requestedLocale ? undefined : extractLocaleToken(message),
      };
    }

    if (matchesAnyPattern(normalized, NEW_CHAT_PATTERNS)) {
      return { kind: 'new_chat' };
    }

    if (matchesAnyPattern(normalized, ASSIGN_HR_PATTERNS)) {
      return {
        kind: 'assign_hr',
        interviewRef: this.extractInterviewRef(message),
        hrRef: this.extractHrRef(message),
      };
    }

    if (matchesAnyPattern(normalized, UNASSIGNED_PATTERNS)) {
      return { kind: 'list_unassigned' };
    }

    if (matchesAnyPattern(normalized, READY_FOR_REVIEW_PATTERNS)) {
      return {
        kind: 'list_interviews',
        filters: { status: 'completed', limit: 20 },
        readyForReview: true,
      };
    }

    if (matchesAnyPattern(normalized, MY_INTERVIEWS_PATTERNS)) {
      return { kind: 'list_interviews', filters: { limit: 20 } };
    }

    if (
      user.role === 'candidate'
      && matchesAnyPattern(normalized, CANDIDATE_OWN_STATUS_PATTERNS)
    ) {
      return {
        kind: 'interview_status',
        ref: {},
        ownInterviews: true,
        scheduleInquiry: matchesAnyPattern(normalized, CANDIDATE_SCHEDULE_PATTERNS),
      };
    }

    if (matchesAnyPattern(normalized, REVIEW_STATE_PATTERNS)) {
      return {
        kind: 'review_state',
        ref: this.extractInterviewRef(message),
      };
    }

    if (matchesAnyPattern(normalized, INTERVIEW_STATUS_PATTERNS)) {
      return {
        kind: 'interview_status',
        ref: this.extractInterviewRef(message),
      };
    }

    if (matchesAnyPattern(normalized, LIST_INTERVIEWS_PATTERNS)) {
      return {
        kind: 'list_interviews',
        filters: this.extractListFilters(normalized),
      };
    }

    return { kind: 'out_of_scope' };
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
