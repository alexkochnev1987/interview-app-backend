import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { Locale } from '../../locale/locale.constants';

export type { ActingUser } from '../../user/interfaces/user.interface';

export interface ParsedRecruiterRequest {
  position: string;
  count: number;
  candidateName?: string;
  candidateEmail?: string;
  locale: Locale;
}

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
  | { kind: 'out_of_scope' };
