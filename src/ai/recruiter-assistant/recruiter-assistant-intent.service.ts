import { Injectable } from '@nestjs/common';

import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { INTERVIEW_STATUSES } from '../../interview/interfaces/interview.interface';
import { Locale } from '../../locale/locale.constants';
import { extractAssessmentFilters } from './recruiter-assistant-assessment-filters-extract';
import { extractCandidateInterviewPosition } from './recruiter-assistant-candidate-position-extract';
import {
  ASSIGN_HR_PATTERNS,
  CANDIDATE_OWN_STATUS_PATTERNS,
  CANDIDATE_SCHEDULE_PATTERNS,
  INTERVIEW_STATUS_PATTERNS,
  LIST_HRS_PATTERNS,
  LIST_INTERVIEWS_PATTERNS,
  matchesAnyPattern,
  matchesCandidateLatestStatusIntent,
  matchesCandidateListActiveIntent,
  matchesCandidateOwnReviewIntent,
  matchesCandidateStatusByPositionIntent,
  matchesCreateIntent,
  matchesCreateInterviewIntent,
  MY_INTERVIEWS_PATTERNS,
  READY_FOR_REVIEW_PATTERNS,
  REVIEW_STATE_PATTERNS,
  SWITCH_LOCALE_PATTERNS,
  NEW_CHAT_PATTERNS,
  UNASSIGNED_PATTERNS,
  matchesCreateSingleQuestionIntent,
  matchesCountQuestionsIntent,
  matchesBulkQuestionCreateIntent,
  LIST_ASSESSMENTS_PATTERNS,
  INTERVIEW_ACTIVITY_SUMMARY_PATTERNS,
  LIST_TEAM_PATTERNS,
  LIST_TEAM_BY_ROLE_PATTERNS,
} from './recruiter-assistant-intent-patterns';
import { extractCreateInterviewFields } from './recruiter-assistant-interview-create-extract';
import {
  extractLocaleToken,
  extractRequestedLocale,
} from './recruiter-assistant-locale-extract';
import {
  extractHrUserId,
  extractHrUserName,
  extractInterviewCandidateName,
  extractInterviewId,
} from './recruiter-assistant-name-extract';
import { extractQuestionFilters } from './recruiter-assistant-question-filters-extract';
import { extractQuestionName } from './recruiter-assistant-question-name-extract';
import { parseRecruiterRequest } from './recruiter-assistant-request-parser';
import { extractTeamRoleFilter } from './recruiter-assistant-team-role-extract';
import {
  ActingUser,
  HrRef,
  InterviewRef,
  RecruiterAssistantIntent,
} from './recruiter-assistant.types';

@Injectable()
export class RecruiterAssistantIntentService {
  classify(
    message: string,
    user: ActingUser,
    locale: Locale,
  ): RecruiterAssistantIntent {
    void locale;
    const normalized = message.toLowerCase().trim();

    if (matchesCountQuestionsIntent(normalized)) {
      return {
        kind: 'count_questions',
        filters: extractQuestionFilters(message),
      };
    }

    if (matchesAnyPattern(normalized, ASSIGN_HR_PATTERNS)) {
      return {
        kind: 'assign_hr',
        interviewRef: this.extractInterviewRef(message),
        hrRef: this.extractHrRef(message),
      };
    }

    if (matchesAnyPattern(normalized, LIST_TEAM_BY_ROLE_PATTERNS)) {
      const role = extractTeamRoleFilter(message);
      if (role) {
        return { kind: 'list_team', role, includeSummary: false };
      }
    }

    if (matchesAnyPattern(normalized, LIST_HRS_PATTERNS)) {
      return { kind: 'list_hrs' };
    }

    if (matchesAnyPattern(normalized, LIST_ASSESSMENTS_PATTERNS)) {
      return {
        kind: 'list_assessments',
        filters: extractAssessmentFilters(message),
      };
    }

    if (matchesAnyPattern(normalized, INTERVIEW_ACTIVITY_SUMMARY_PATTERNS)) {
      return { kind: 'interview_activity_summary' };
    }

    if (matchesAnyPattern(normalized, LIST_TEAM_PATTERNS)) {
      return { kind: 'list_team', includeSummary: true };
    }

    if (matchesCreateInterviewIntent(normalized)) {
      const fields = extractCreateInterviewFields(message);
      return {
        kind: 'create_interview',
        candidateName: fields.candidateName,
        position: fields.position,
      };
    }

    if (
      matchesCreateIntent(normalized) &&
      matchesBulkQuestionCreateIntent(normalized)
    ) {
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

    if (matchesCreateIntent(normalized)) {
      return {
        kind: 'create_questions_interview',
        parsed: parseRecruiterRequest(message, locale),
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

    if (user.role === 'candidate') {
      const candidateIntent = this.classifyCandidateIntent(message, normalized);
      if (candidateIntent) {
        return candidateIntent;
      }
    }

    if (matchesAnyPattern(normalized, MY_INTERVIEWS_PATTERNS)) {
      return {
        kind: 'list_interviews',
        filters: { limit: 20, assignedHrId: user.id },
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

  private classifyCandidateIntent(
    message: string,
    normalized: string,
  ): RecruiterAssistantIntent | null {
    if (matchesCandidateListActiveIntent(normalized)) {
      return { kind: 'list_own_interviews', activeOnly: true };
    }

    if (matchesCandidateLatestStatusIntent(normalized)) {
      return {
        kind: 'interview_status',
        ref: {},
        ownInterviews: true,
        latest: true,
      };
    }

    if (matchesCandidateOwnReviewIntent(normalized)) {
      return {
        kind: 'review_state',
        ref: this.extractCandidateInterviewRef(message),
      };
    }

    const position = extractCandidateInterviewPosition(message);
    if (matchesCandidateStatusByPositionIntent(normalized, Boolean(position))) {
      return {
        kind: 'interview_status',
        ref: { position: position! },
        ownInterviews: true,
      };
    }

    if (matchesAnyPattern(normalized, CANDIDATE_OWN_STATUS_PATTERNS)) {
      return {
        kind: 'interview_status',
        ref: {},
        ownInterviews: true,
        scheduleInquiry: matchesAnyPattern(
          normalized,
          CANDIDATE_SCHEDULE_PATTERNS,
        ),
      };
    }

    return null;
  }

  private extractCandidateInterviewRef(message: string): InterviewRef {
    const position = extractCandidateInterviewPosition(message);
    return position ? { position } : {};
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
      const spaced = status.replaceAll('_', ' ');
      const pattern = new RegExp(
        `\\b${spaced.replace(/\s+/g, '\\s+')}\\b|\\b${status}\\b`,
      );
      if (pattern.test(normalized)) {
        filters.status = status;
        break;
      }
    }

    return filters;
  }
}
