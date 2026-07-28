import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CandidateFeedbackService } from '../../feedback/candidate-feedback.service';
import { hasAnyPublishableCandidateFeedbackBlock } from '../../feedback/present-public-candidate-feedback';
import { Locale } from '../../locale/locale.constants';
import { ASSIGNED_HR_FILTER_UNASSIGNED } from '../../interview/assigned-hr-filter';
import { InterviewService } from '../../interview/interview.service';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { UserService } from '../../user/user.service';
import {
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import {
  canAssignHr,
  canCreateInterviews,
  canCreateQuestions,
  canReadQuestions,
  canListInterviews,
} from './recruiter-assistant.policy';
import { buildQuestionPlanResponse } from './recruiter-assistant-response';
import { resolveHrRef } from './recruiter-assistant-hr-ref';
import { resolveInterviewRef } from './recruiter-assistant-interview-ref';
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
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly databaseService: DatabaseService,
    private readonly userService: UserService,
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

  async getInterviewStatus(
    ref: InterviewRef,
    user: ActingUser,
    locale: Locale,
    ownInterviews?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;

    if (ownInterviews) {
      if (user.role !== 'candidate') {
        return { status: 'refused', response: 'That question is only for candidates.' };
      }
      const { items } = await this.interviewService.findAllPaginated(
        { q: user.email.split('@')[0], limit: 5 },
        { id: user.id, role: user.role, demo: user.demo },
      );
      const mine = items.filter(
        (item) => item.candidateEmail?.toLowerCase() === user.email.toLowerCase(),
      );
      if (mine.length === 0) {
        return { status: 'answered', response: 'You do not have an interview yet.' };
      }
      const interview = mine[0];
      return {
        status: 'answered',
        response: `Your interview for ${interview.position} is ${interview.status.replace('_', ' ')}.`,
        interview: {
          id: interview.id,
          candidateName: interview.candidateName,
          position: interview.position,
          status: interview.status,
        },
      };
    }

    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to look up interview status.',
        escalateTo: 'admin',
      };
    }
    const actor = { id: user.id, role: user.role, demo: user.demo };
    const resolved = await resolveInterviewRef(this.interviewService, ref, actor);
    if (!resolved) {
      return {
        status: 'answered',
        response: 'I could not find a unique interview. Provide an interview id or candidate name.',
      };
    }

    return {
      status: 'answered',
      response: `${resolved.candidateName}'s interview for ${resolved.position} is ${resolved.status.replace('_', ' ')}.`,
      interview: resolved,
    };
  }

  async getReviewState(
    ref: InterviewRef,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;

    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to check review state.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const actor = { id: user.id, role: user.role, demo: user.demo };
    const resolved = await resolveInterviewRef(this.interviewService, ref, actor);
    if (!resolved) {
      return {
        status: 'answered',
        response:
          'I could not find a unique interview. Provide an interview id or candidate name.',
      };
    }

    const interview = await this.interviewService.findOneForActor(resolved.id, actor);
    const feedback = await this.candidateFeedbackService.findByInterviewId(interview.id);
    const shareLinkActive = await this.hasActiveShareLink(interview.id);

    const reviewed =
      interview.status === 'completed'
      && (
        !!interview.result?.decision
        || !!feedback?.outcome
        || (feedback != null && hasAnyPublishableCandidateFeedbackBlock(feedback))
      );

    const reviewState = {
      reviewed,
      shareLinkActive,
      outcome: feedback?.outcome ?? interview.result?.decision,
    };

    const response = reviewed
      ? `${resolved.candidateName}'s interview has been reviewed${reviewState.outcome ? ` (${reviewState.outcome})` : ''}.`
      : `${resolved.candidateName}'s interview has not been reviewed yet.`;

    return {
      status: 'answered',
      response,
      interview: {
        id: resolved.id,
        candidateName: resolved.candidateName,
        position: resolved.position,
        status: resolved.status,
        reviewState,
      },
    };
  }

  async prepareAssignHr(
    intent: Extract<RecruiterAssistantIntent, { kind: 'assign_hr' }>,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;

    if (!canAssignHr(user)) {
      return {
        status: 'denied',
        response: 'Only admins can assign HR reviewers.',
        escalateTo: 'admin',
      };
    }

    const actor = { id: user.id, role: user.role, demo: user.demo };
    const interview = await resolveInterviewRef(
      this.interviewService,
      intent.interviewRef,
      actor,
    );
    if (!interview) {
      return {
        status: 'answered',
        response:
          'I could not find a unique interview. Provide an interview id or candidate name.',
      };
    }

    const hrUser = await resolveHrRef(this.userService, intent.hrRef, user.demo);
    if (!hrUser) {
      return {
        status: 'answered',
        response:
          'I could not find a unique HR user. Say something like "assign interview for Alice to Jane".',
      };
    }

    const interviewLabel = `${interview.candidateName} (${interview.position})`;
    const pendingAction: RecruiterAssistantAssignHrPendingActionDto = {
      type: 'assign_hr',
      interviewId: interview.id,
      assignedHrId: hrUser.id,
      assignedHrName: hrUser.name,
      interviewLabel,
    };

    return {
      status: 'needs_confirmation',
      response: `Assign ${interviewLabel} to ${hrUser.name}? Reply yes to confirm.`,
      pendingAction,
    };
  }

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

  private async hasActiveShareLink(interviewId: string): Promise<boolean> {
    const result = await this.databaseService.query(
      `
        SELECT 1
        FROM candidate_feedback_share_links
        WHERE interview_id = $1
          AND revoked_at IS NULL
          AND expires_at IS NOT NULL
          AND expires_at > NOW()
        LIMIT 1
      `,
      [interviewId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
