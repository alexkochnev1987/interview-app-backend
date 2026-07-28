import { Injectable } from '@nestjs/common';
import { Locale } from '../../locale/locale.constants';
import { ASSIGNED_HR_FILTER_UNASSIGNED } from '../../interview/assigned-hr-filter';
import { InterviewService } from '../../interview/interview.service';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import {
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import {
  canCreateInterviews,
  canCreateQuestions,
  canReadQuestions,
  canListInterviews,
} from './recruiter-assistant.policy';
import { buildQuestionPlanResponse } from './recruiter-assistant-response';
import {
  ActingUser,
  InterviewRef,
  ParsedRecruiterRequest,
  RecruiterAssistantIntent,
} from './recruiter-assistant.types';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';
import { buildQuestionSuggestions } from './recruiter-question-plan';

@Injectable()
export class RecruiterAssistantToolsService {
  constructor(
    private readonly questionMatcher: RecruiterQuestionMatcherService,
    private readonly interviewService: InterviewService,
  ) {}

  async listInterviews(
    filters: QueryInterviewsDto,
    user: ActingUser,
    locale: Locale,
    readyForReview?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;

    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to list interviews.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const query: QueryInterviewsDto = { ...filters };
    if (readyForReview && user.role === 'hr') {
      query.assignedHrId = user.id;
    }

    const { items, total } = await this.interviewService.findAllPaginated(
      query,
      { id: user.id, role: user.role, demo: user.demo },
    );

    if (items.length === 0) {
      return {
        status: 'answered',
        response: readyForReview
          ? 'No completed interviews are ready for your review.'
          : 'No interviews matched your request.',
        interviews: [],
      };
    }

    return {
      status: 'answered',
      response: `Found ${total} interview(s). Showing ${items.length}.`,
      interviews: items,
    };
  }

  listUnassigned(
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    return this.listInterviews(
      { assignedHrId: ASSIGNED_HR_FILTER_UNASSIGNED, limit: 20 },
      user,
      locale,
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars -- chat tools filled in Step 7+ */

  getInterviewStatus(
    ref: InterviewRef,
    user: ActingUser,
    locale: Locale,
    ownInterviews?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void ref;
    void user;
    void locale;
    void ownInterviews;
    return Promise.resolve({
      status: 'refused',
      response: 'Interview status via chat is not implemented yet.',
    });
  }

  getReviewState(
    ref: InterviewRef,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void ref;
    void user;
    void locale;
    return Promise.resolve({
      status: 'refused',
      response: 'Review state via chat is not implemented yet.',
    });
  }

  prepareAssignHr(
    intent: Extract<RecruiterAssistantIntent, { kind: 'assign_hr' }>,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void intent;
    void user;
    void locale;
    return Promise.resolve({
      status: 'refused',
      response: 'Assign HR via chat is not implemented yet.',
    });
  }

  /* eslint-enable @typescript-eslint/no-unused-vars */

  async prepareCreateQuestions(
    parsed: ParsedRecruiterRequest,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canReadQuestions(user)) {
      return {
        status: 'denied',
        response:
          'You do not have permission to read the question bank for interview preparation.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const suggestions = buildQuestionSuggestions(parsed);
    const resolved = await this.questionMatcher.resolveExistingQuestions(
      suggestions,
      user,
      locale,
    );
    const existingCount = resolved.filter((question) => !question.needsCreation).length;
    const missingCount = resolved.length - existingCount;
    const userCanCreateQuestions = canCreateQuestions(user);
    const userCanCreateInterviews = canCreateInterviews(user);
    const pendingAction: RecruiterAssistantCreatePendingActionDto = {
      type:
        parsed.candidateName && userCanCreateInterviews
          ? 'create_interview'
          : 'create_questions',
      position: parsed.position,
      candidateName: parsed.candidateName,
      candidateEmail: parsed.candidateEmail,
      interviewLocale: parsed.locale,
      questions: resolved,
    };

    return {
      status: 'needs_confirmation',
      response: buildQuestionPlanResponse({
        existingCount,
        missingCount,
        canCreateQuestions: userCanCreateQuestions,
        canCreateInterviews: userCanCreateInterviews,
        candidateName: parsed.candidateName,
      }),
      suggestedQuestions: resolved,
      pendingAction,
    };
  }
}
