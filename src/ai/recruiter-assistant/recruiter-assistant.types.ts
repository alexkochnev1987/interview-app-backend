import { Locale } from '../../locale/locale.constants';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { User } from '../../user/interfaces/user.interface';

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
  | 'interview_status'
  | 'review_state'
  | 'assign_hr'
  | 'create_questions_interview'
  | 'switch_locale'
  | 'new_chat'
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
  | { kind: 'list_interviews'; filters: QueryInterviewsDto; readyForReview?: boolean }
  | { kind: 'list_unassigned' }
  | { kind: 'interview_status'; ref: InterviewRef; ownInterviews?: boolean; scheduleInquiry?: boolean }
  | { kind: 'review_state'; ref: InterviewRef }
  | {
      kind: 'assign_hr';
      interviewRef: InterviewRef;
      hrRef: HrRef;
    }
  | { kind: 'create_questions_interview'; parsed: ParsedRecruiterRequest }
  | { kind: 'switch_locale'; requestedLocale: Locale | null; rawToken?: string }
  | { kind: 'new_chat' }
  | { kind: 'out_of_scope' };
