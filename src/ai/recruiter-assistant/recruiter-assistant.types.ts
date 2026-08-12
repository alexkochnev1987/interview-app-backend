import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { Locale } from '../../locale/locale.constants';
import { QueryQuestionsDto } from '../../question/dto/query-questions.dto';
import { User, UserRole } from '../../user/interfaces/user.interface';

export type ActingUser = Omit<User, 'passwordHash'>;

export interface ParsedRecruiterRequest {
  position: string;
  count: number;
  candidateName?: string;
  candidateEmail?: string;
  locale: Locale;
}

export type RecruiterAssistantIntentKind =
  | 'list_interviews'
  | 'list_unassigned'
  | 'list_hrs'
  | 'interview_status'
  | 'review_state'
  | 'assign_hr'
  | 'create_questions_interview'
  | 'create_question'
  | 'create_interview'
  | 'switch_locale'
  | 'new_chat'
  | 'count_questions'
  | 'list_assessments'
  | 'interview_activity_summary'
  | 'list_team'
  | 'out_of_scope';

export interface InterviewRef {
  interviewId?: string;
  candidateName?: string;
}

export interface HrRef {
  id?: string;
  name?: string;
}

export type RecruiterAssistantIntent =
  | {
      kind: 'list_interviews';
      filters: QueryInterviewsDto;
      readyForReview?: boolean;
    }
  | { kind: 'list_unassigned' }
  | { kind: 'list_hrs' }
  | {
      kind: 'interview_status';
      ref: InterviewRef;
      ownInterviews?: boolean;
      scheduleInquiry?: boolean;
    }
  | { kind: 'review_state'; ref: InterviewRef }
  | {
      kind: 'assign_hr';
      interviewRef: InterviewRef;
      hrRef: HrRef;
    }
  | { kind: 'create_questions_interview'; parsed: ParsedRecruiterRequest }
  | { kind: 'create_question'; questionName?: string }
  | { kind: 'create_interview'; candidateName?: string; position?: string }
  | { kind: 'switch_locale'; requestedLocale: Locale | null; rawToken?: string }
  | { kind: 'new_chat' }
  | { kind: 'count_questions'; filters: QueryQuestionsDto }
  | {
      kind: 'list_assessments';
      filters: { position?: string; nameContains?: string };
    }
  | { kind: 'interview_activity_summary' }
  | { kind: 'list_team'; role?: UserRole; includeSummary: boolean }
  | { kind: 'out_of_scope' };
