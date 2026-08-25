import { Injectable, Logger } from '@nestjs/common';

import { RecruiterAssistantConfigService } from '../../app-config/recruiter-assistant-config.service';
import { CandidateFeedbackShareService } from '../../feedback/candidate-feedback-share.service';
import { CandidateFeedbackService } from '../../feedback/candidate-feedback.service';
import { hasAnyPublishableCandidateFeedbackBlock } from '../../feedback/present-public-candidate-feedback';
import { ASSIGNED_HR_FILTER_UNASSIGNED } from '../../interview/assigned-hr-filter';
import { AssignedHrDto } from '../../interview/dto/interview.responses.dto';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { InterviewListItem } from '../../interview/interfaces/interview.interface';
import { toInterviewActor } from '../../interview/interview-actor';
import {
  InterviewService,
  MAX_INTERVIEWS_LIMIT,
} from '../../interview/interview.service';
import { Locale } from '../../locale/locale.constants';
import { QueryQuestionsDto } from '../../question/dto/query-questions.dto';
import { QuestionService } from '../../question/question.service';
import {
  TemplateService,
  TemplateSummary,
} from '../../template/template.service';
import { UserRole } from '../../user/interfaces/user.interface';
import { CandidateSummary, UserService } from '../../user/user.service';
import { AiService } from '../ai.service';
import {
  loadAllCandidateInterviews,
  resolveLatestInterview,
} from './candidate-interview-resolver';
import {
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantCreateSingleQuestionPendingActionDto,
  RecruiterAssistantRedirectDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import type { QueryAssessmentsFilters } from './recruiter-assistant-assessment-filters-extract';
import {
  filterAssessmentsByReviewStatus,
  matchesAssessmentQuery,
  selectHrVisibleAssessmentListItems,
} from './recruiter-assistant-assessment-status';
import {
  parseCandidateChoice,
  parseRegisteredCandidateConfirmation,
} from './recruiter-assistant-candidate-choice-parse';
import { findMatchingCandidates as findMatchingCandidatesByName } from './recruiter-assistant-candidate-match';
import { resolveHrRef } from './recruiter-assistant-hr-ref';
import { buildInterviewActivityFromStatusFacets } from './recruiter-assistant-interview-activity';
import { resolveInterviewRef } from './recruiter-assistant-interview-ref';
import { scorePersonNameMatch } from './recruiter-assistant-name-match';
import { buildQuestionPlanResponse } from './recruiter-assistant-response';
import {
  buildAssessmentsListRedirect,
  buildInterviewRedirect,
  buildQuestionsListRedirect,
  buildSimilarQuestionMatchCards,
} from './recruiter-assistant-response-builders';
import {
  buildTeamSummaryFromRoleCounts,
  mapUsersToAuthUserResponseDtos,
} from './recruiter-assistant-team';
import { parseTemplateChoice } from './recruiter-assistant-template-choice-parse';
import {
  canAssignHr,
  canCreateInterviews,
  canCreateQuestions,
  canReadQuestions,
  canReadTemplates,
  canListInterviews,
  canListTeam,
  isCancellationMessage,
  NEW_CHAT_WELCOME_RESPONSE,
} from './recruiter-assistant.policy';
import {
  ActingUser,
  HrRef,
  InterviewRef,
  ParsedRecruiterRequest,
  RecruiterAssistantIntent,
} from './recruiter-assistant.types';
import {
  idleConversationState,
  startConversationFlow,
} from './recruiter-conversation-slots';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterConversationState } from './recruiter-conversation.types';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import {
  isQuestionDraftGenerate,
  mapDraftGenerateToCreateQuestionDto,
} from './recruiter-question-draft.mapper';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';
import { buildQuestionSuggestions } from './recruiter-question-plan';

const MAX_RECRUITER_ASSISTANT_HR_LIST_LIMIT = 100;
const MAX_RECRUITER_ASSISTANT_CANDIDATE_LIST_LIMIT = 20;
const MAX_RECRUITER_ASSISTANT_TEAM_LIST_LIMIT = 200;
/** Max paginated pages when scanning interviews for assessment counts. */
const MAX_ASSESSMENT_SCAN_PAGES = 10;

/** User-facing assistant strings are English-only (see module known limitations). */
@Injectable()
export class RecruiterAssistantToolsService {
  private readonly logger = new Logger(RecruiterAssistantToolsService.name);

  constructor(
    private readonly questionMatcher: RecruiterQuestionMatcherService,
    private readonly questionService: QuestionService,
    private readonly interviewService: InterviewService,
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly candidateFeedbackShareService: CandidateFeedbackShareService,
    private readonly userService: UserService,
    private readonly pendingActionStore: RecruiterPendingActionStore,
    private readonly conversationStore: RecruiterConversationStore,
    private readonly aiService: AiService,
    private readonly templateService: TemplateService,
    private readonly recruiterAssistantConfig: RecruiterAssistantConfigService,
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
      toInterviewActor(user),
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

  async countQuestions(
    filters: QueryQuestionsDto,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canReadQuestions(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to read the question bank.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const listFilters = this.questionCountListFilters(filters);
    const hasFilters = Object.keys(listFilters).length > 0;
    const countQuery: QueryQuestionsDto =
      user.role === 'super_admin' && !listFilters.status
        ? { ...listFilters, status: 'all', limit: 1 }
        : { ...listFilters, limit: 1 };

    const { total } = await this.questionService.findAll(countQuery, {
      forceActive: user.role !== 'super_admin',
      resolveLocale: locale,
      demo: user.demo,
    });

    return {
      status: 'answered',
      response: hasFilters
        ? `${total} question(s) match your filters. Open the question bank to browse them.`
        : `You have ${total} question(s) in total. Open the question bank to browse them.`,
      questionCount: {
        total,
        filters: hasFilters ? listFilters : undefined,
      },
      redirect: buildQuestionsListRedirect(listFilters),
    };
  }

  async listAssessments(
    filters: QueryAssessmentsFilters,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to read assessments.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const listFilters = this.assessmentCountListFilters(filters);
    const { items: interviews, truncated } =
      await this.fetchAssessmentInterviews(user);
    let visible = selectHrVisibleAssessmentListItems(interviews);
    visible = filterAssessmentsByReviewStatus(visible, listFilters.status);
    if (listFilters.q) {
      visible = visible.filter((item) =>
        matchesAssessmentQuery(item, listFilters.q!),
      );
    }

    const total = visible.length;
    const hasFilters = Object.keys(listFilters).length > 0;
    const scanLimit = MAX_ASSESSMENT_SCAN_PAGES * MAX_INTERVIEWS_LIMIT;
    const truncatedNote = truncated
      ? ` (count from the ${scanLimit} most recently updated interviews; open the assessments page for the full list)`
      : '';

    return {
      status: 'answered',
      response: hasFilters
        ? `${total} assessment(s) match your filters.${truncatedNote} Open the assessments page to browse them.`
        : `You have ${total} assessment(s) in total.${truncatedNote} Open the assessments page to browse them.`,
      assessmentCount: {
        total,
        filters: hasFilters ? listFilters : undefined,
      },
      redirect: buildAssessmentsListRedirect(listFilters),
    };
  }

  async summarizeInterviewActivity(
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to summarize interview activity.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const { statuses } = await this.interviewService.getFacets(
      {},
      toInterviewActor(user),
    );
    const interviewActivity = buildInterviewActivityFromStatusFacets(statuses);

    return {
      status: 'answered',
      response:
        `Your org has ${interviewActivity.total} interview(s): ` +
        `${interviewActivity.active} active, ` +
        `${interviewActivity.completed} completed, ` +
        `${interviewActivity.failed} failed.`,
      interviewActivity,
    };
  }

  async listTeam(
    user: ActingUser,
    locale: Locale,
    options: { role?: UserRole; includeSummary: boolean },
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canListTeam(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to list team members.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const [teamSummary, members] = await Promise.all([
      options.includeSummary
        ? this.userService
            .countUsersByRole({ demo: user.demo })
            .then(buildTeamSummaryFromRoleCounts)
        : Promise.resolve(undefined),
      this.userService.listAll({
        demo: user.demo,
        role: options.role,
        limit: MAX_RECRUITER_ASSISTANT_TEAM_LIST_LIMIT,
      }),
    ]);

    const teamMembers = await mapUsersToAuthUserResponseDtos(
      members,
      this.recruiterAssistantConfig,
    );

    if (teamMembers.length === 0) {
      return {
        status: 'answered',
        response: 'No team members found.',
        teamSummary,
        teamMembers: [],
      };
    }

    const summaryLine = teamSummary
      ? `${teamSummary.superAdmin} super_admin, ${teamSummary.admin} admin, ${teamSummary.hr} hr, ${teamSummary.candidate} candidate (${teamSummary.total} total). `
      : '';
    const roleLabel = options.role ? ` ${options.role}` : '';

    return {
      status: 'answered',
      response: `${summaryLine}Showing ${teamMembers.length}${roleLabel} team member(s).`,
      teamSummary,
      teamMembers,
    };
  }

  async listHrs(
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canAssignHr(user)) {
      return {
        status: 'denied',
        response: 'Only admins can list HR reviewers.',
        escalateTo: 'admin',
      };
    }

    const hrs = await this.fetchAvailableHrs(user);
    if (hrs.length === 0) {
      return {
        status: 'answered',
        response: 'No HR reviewers available.',
        hrs: [],
      };
    }

    return {
      status: 'answered',
      response: `Found ${hrs.length} HR reviewer(s).`,
      hrs,
    };
  }

  async listOwnInterviews(
    user: ActingUser,
    locale: Locale,
    activeOnly?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    void activeOnly;
    if (user.role !== 'candidate') {
      return {
        status: 'refused',
        response: 'That question is only for candidates.',
      };
    }

    return {
      status: 'refused',
      response:
        'Listing your interviews is not available yet. Ask about the status of a specific interview instead.',
    };
  }

  async getInterviewStatus(
    ref: InterviewRef,
    user: ActingUser,
    locale: Locale,
    ownInterviews?: boolean,
    scheduleInquiry?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (ownInterviews) {
      if (user.role !== 'candidate') {
        return {
          status: 'refused',
          response: 'That question is only for candidates.',
        };
      }

      const interview = await this.findCandidateOwnInterview(user);
      if (!interview) {
        return {
          status: 'answered',
          response: 'You do not have an interview yet.',
        };
      }

      const statusText = interview.status.replace('_', ' ');
      const response = scheduleInquiry
        ? `Your interview for ${interview.position} is ${statusText}. It was created on ${interview.createdAt.toISOString().slice(0, 10)}. This app does not store a separate interview time or location yet — use your interview link when the status is pending or in progress.`
        : `Your interview for ${interview.position} is ${statusText}.`;

      return {
        status: 'answered',
        response,
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

    const interview = await resolveInterviewRef(
      this.interviewService,
      ref,
      toInterviewActor(user),
    );
    if (!interview) {
      return {
        status: 'answered',
        response:
          'I could not find a unique interview. Provide an interview id or candidate name.',
      };
    }

    return {
      status: 'answered',
      response: `${interview.candidateName}'s interview for ${interview.position} is ${interview.status.replace('_', ' ')}.`,
      interview: {
        id: interview.id,
        candidateName: interview.candidateName,
        position: interview.position,
        status: interview.status,
      },
    };
  }

  async getReviewState(
    ref: InterviewRef,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;

    if (user.role === 'candidate') {
      return this.getCandidateReviewState(user, ref);
    }

    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to check review state.',
        escalateTo: 'admin',
      };
    }

    const interview = await resolveInterviewRef(
      this.interviewService,
      ref,
      toInterviewActor(user),
    );
    if (!interview) {
      return {
        status: 'answered',
        response:
          'I could not find a unique interview. Provide an interview id or candidate name.',
      };
    }

    const feedback = await this.candidateFeedbackService.findByInterviewId(
      interview.id,
    );
    const shareLinkActive =
      await this.candidateFeedbackShareService.hasActiveShareLink(interview.id);

    const reviewed =
      interview.status === 'completed' &&
      (!!interview.result?.decision ||
        !!feedback?.outcome ||
        (feedback != null &&
          hasAnyPublishableCandidateFeedbackBlock(feedback)));

    const reviewState = {
      reviewed,
      shareLinkActive,
      outcome: feedback?.outcome ?? interview.result?.decision,
    };

    const response = reviewed
      ? `${interview.candidateName}'s interview has been reviewed${reviewState.outcome ? ` (${reviewState.outcome})` : ''}.`
      : `${interview.candidateName}'s interview has not been reviewed yet.`;

    return {
      status: 'answered',
      response,
      interview: {
        id: interview.id,
        candidateName: interview.candidateName,
        position: interview.position,
        status: interview.status,
        reviewState,
      },
    };
  }

  async prepareAssignHr(
    intent: Extract<RecruiterAssistantIntent, { kind: 'assign_hr' }>,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canAssignHr(user)) {
      return {
        status: 'denied',
        response: 'Only admins can assign HR reviewers.',
        escalateTo: 'admin',
      };
    }

    return this.progressAssignHrFlow(
      {
        interviewRef: intent.interviewRef,
        hrRef: intent.hrRef,
      },
      user,
      sessionId,
      { persistFlowOnMissing: true },
    );
  }

  async prepareCreateQuestion(
    questionName: string | undefined,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateQuestions(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to create questions.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    if (!questionName) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('create_question', 'questionName'),
      );
      return {
        status: 'answered',
        response: 'What should the question be called?',
        awaitingInput: 'questionName',
      };
    }

    return this.progressCreateQuestionFlow(
      questionName,
      user,
      locale,
      sessionId,
    );
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
    const existingCount = resolved.filter(
      (question) => !question.needsCreation,
    ).length;
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
      pendingActionId: await this.pendingActionStore.issue(
        user.id,
        pendingAction,
      ),
    };
  }

  switchLocale(
    requestedLocale: Locale | null,
    rawToken: string | undefined,
    locale: Locale,
  ): RecruiterAssistantResponseDto {
    void locale;
    if (!requestedLocale) {
      return {
        status: 'refused',
        response: rawToken
          ? `"${rawToken}" is not a supported locale. Supported: en, be, ru, pl.`
          : 'Say "switch locale to ru" (supported: en, be, ru, pl).',
      };
    }

    return {
      status: 'answered',
      response: `Application language switched to ${requestedLocale}.`,
      locale: requestedLocale,
    };
  }

  startNewChat(): RecruiterAssistantResponseDto {
    return {
      status: 'answered',
      response: NEW_CHAT_WELCOME_RESPONSE,
    };
  }

  async continueAssignHrFlow(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canAssignHr(user)) {
      return {
        status: 'denied',
        response: 'Only admins can assign HR reviewers.',
        escalateTo: 'admin',
      };
    }

    return this.progressAssignHrFlow(
      {
        interviewRef: {},
        hrRef: {},
        slots: state.slots,
      },
      user,
      sessionId,
      { persistFlowOnMissing: true },
    );
  }

  async continueCreateQuestionFlow(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateQuestions(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to create questions.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const questionName = state.slots.questionName;
    if (!questionName) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('create_question', 'questionName'),
      );
      return {
        status: 'answered',
        response: 'What should the question be called?',
        awaitingInput: 'questionName',
      };
    }

    return this.progressCreateQuestionFlow(
      questionName,
      user,
      locale,
      sessionId,
    );
  }

  async continueCreateQuestionDespiteSimilar(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateQuestions(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to create questions.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const questionName = state.slots.questionName;
    if (!questionName) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('create_question', 'questionName'),
      );
      return {
        status: 'answered',
        response: 'What should the question be called?',
        awaitingInput: 'questionName',
      };
    }

    const response = await this.progressCreateQuestionDraftAndConfirm(
      questionName,
      user,
      locale,
      sessionId,
    );

    if (response.status === 'refused') {
      const matches =
        await this.questionMatcher.findSimilarMatchesOverThreshold(
          questionName,
          user,
          locale,
        );
      if (matches.length > 0) {
        this.conversationStore.update(
          user.id,
          sessionId,
          startConversationFlow('create_question', 'confirmAddDespiteSimilar', {
            questionName,
          }),
        );
        return {
          status: 'answered',
          response: `${response.response} Reply yes to try again, or no/cancel to abort.`,
          awaitingInput: 'confirmAddDespiteSimilar',
          similarQuestions: buildSimilarQuestionMatchCards(matches),
        };
      }
    }

    return response;
  }

  async repromptSimilarQuestionConfirmation(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    const questionName = state.slots.questionName;
    if (!questionName) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('create_question', 'questionName'),
      );
      return {
        status: 'answered',
        response: 'What should the question be called?',
        awaitingInput: 'questionName',
      };
    }

    const matches = await this.questionMatcher.findSimilarMatchesOverThreshold(
      questionName,
      user,
      locale,
    );

    this.conversationStore.update(
      user.id,
      sessionId,
      startConversationFlow('create_question', 'confirmAddDespiteSimilar', {
        questionName,
      }),
    );

    return {
      status: 'answered',
      response: 'Reply yes to add the question anyway, or no/cancel to abort.',
      awaitingInput: 'confirmAddDespiteSimilar',
      similarQuestions: buildSimilarQuestionMatchCards(matches),
    };
  }

  async prepareCreateInterview(
    candidateName: string | undefined,
    position: string | undefined,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to create interviews.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    return this.progressCreateInterviewFlow(
      { candidateName, position },
      user,
      locale,
      sessionId,
      { persistFlowOnMissing: true },
    );
  }

  async continueCreateInterviewRegisteredCandidateConfirm(
    state: RecruiterConversationState,
    message: string,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to create interviews.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const confirmation = parseRegisteredCandidateConfirmation(message);
    if (!confirmation) {
      return this.repromptRegisteredCandidateConfirm(state, user, sessionId);
    }

    const baseSlots = this.stripTransientCandidateSlots(state.slots);
    const nextSlots =
      confirmation === 'yes'
        ? {
            ...baseSlots,
            ...this.registeredCandidateSlots({
              id: state.slots.matchedCandidateId ?? '',
              name: state.slots.matchedCandidateName ?? '',
              email: state.slots.matchedCandidateEmail ?? '',
            }),
          }
        : {
            ...baseSlots,
            candidateName: state.slots.candidateName ?? '',
            candidateResolution: 'new',
          };

    this.conversationStore.update(user.id, sessionId, {
      flow: 'create_interview',
      slots: nextSlots,
      awaitingInput: undefined,
    });

    return this.continueCreateInterviewFlow(
      { flow: 'create_interview', slots: nextSlots },
      user,
      locale,
      sessionId,
    );
  }

  repromptRegisteredCandidateConfirm(
    state: RecruiterConversationState,
    user: ActingUser,
    sessionId: string,
  ): RecruiterAssistantResponseDto {
    const candidate = {
      id: state.slots.matchedCandidateId ?? '',
      name: state.slots.matchedCandidateName ?? '',
      email: state.slots.matchedCandidateEmail ?? '',
    };

    this.conversationStore.update(user.id, sessionId, {
      flow: 'create_interview',
      slots: state.slots,
      awaitingInput: 'confirmRegisteredCandidate',
    });

    return {
      status: 'answered',
      response: `Use registered candidate ${candidate.name} (${candidate.email})? Reply yes or no.`,
      awaitingInput: 'confirmRegisteredCandidate',
      candidates: [candidate],
    };
  }

  async continueCreateInterviewFlow(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
    message?: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateInterviews(user)) {
      return {
        status: 'denied',
        response: 'You do not have permission to create interviews.',
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    if (state.awaitingInput === 'confirmRegisteredCandidate' && message) {
      if (isCancellationMessage(message)) {
        this.conversationStore.update(
          user.id,
          sessionId,
          idleConversationState(),
        );
        return {
          status: 'answered',
          response: 'Cancelled. No changes were made.',
        };
      }

      return this.continueCreateInterviewRegisteredCandidateConfirm(
        state,
        message,
        user,
        locale,
        sessionId,
      );
    }

    if (state.slots.candidateChoice && !this.isCandidateResolved(state.slots)) {
      return this.continueCreateInterviewCandidateChoice(
        state,
        user,
        locale,
        sessionId,
      );
    }

    if (this.isCandidateResolved(state.slots) && state.slots.templateChoice) {
      return this.progressTemplateChoiceFlow(
        state.slots,
        user,
        locale,
        sessionId,
      );
    }

    return this.progressCreateInterviewFlow(
      { slots: state.slots },
      user,
      locale,
      sessionId,
      { persistFlowOnMissing: true },
    );
  }

  private async continueCreateInterviewCandidateChoice(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    return this.resolveCandidateChoiceFromSlots(
      state.slots,
      user,
      locale,
      sessionId,
      true,
    );
  }

  private async progressTemplateChoiceFlow(
    slots: Record<string, string>,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    const candidateName = slots.candidateName;
    const position = slots.position;
    const templates = await this.loadStoredTemplates(slots, user, locale);
    const choice = parseTemplateChoice(slots.templateChoice ?? '');

    if (!choice) {
      const rest = Object.fromEntries(
        Object.entries(slots).filter(([key]) => key !== 'templateChoice'),
      );
      this.conversationStore.update(user.id, sessionId, {
        flow: 'create_interview',
        slots: rest,
        awaitingInput: 'templateChoice',
      });
      return {
        status: 'answered',
        response: 'Pick a number from the list or say "create my own".',
        awaitingInput: 'templateChoice',
        templates,
      };
    }

    if (choice.kind === 'own') {
      this.conversationStore.update(
        user.id,
        sessionId,
        idleConversationState(),
      );
      return {
        status: 'answered',
        response: 'Opening the interview form.',
        redirect: this.buildCreateInterviewRedirect(slots),
      };
    }

    const selected = templates[choice.index - 1];
    if (!selected) {
      const rest = Object.fromEntries(
        Object.entries(slots).filter(([key]) => key !== 'templateChoice'),
      );
      this.conversationStore.update(user.id, sessionId, {
        flow: 'create_interview',
        slots: rest,
        awaitingInput: 'templateChoice',
      });
      return {
        status: 'answered',
        response: `Template ${choice.index} is not in the list. Pick a number from 1 to ${templates.length} or say "create my own".`,
        awaitingInput: 'templateChoice',
        templates,
      };
    }

    const template = await this.templateService.findOne(selected.id, locale, {
      demo: user.demo,
    });

    if (template.questions.length === 0) {
      this.conversationStore.update(
        user.id,
        sessionId,
        idleConversationState(),
      );
      return {
        status: 'refused',
        response: `Template "${template.name}" has no available questions. Try another template or say "create my own".`,
        redirect: this.buildCreateInterviewRedirect(slots),
      };
    }

    const questions = template.questions.map((question, index) => ({
      key: `template-${index + 1}`,
      questionText: question.questionText,
      existingQuestionId: question.id,
      existingQuestionText: question.questionText,
      needsCreation: false,
    }));

    const pendingAction: RecruiterAssistantCreatePendingActionDto = {
      type: 'create_interview',
      position: position ?? template.position ?? '',
      candidateName,
      candidateEmail: slots.candidateEmail,
      interviewLocale: locale,
      questions,
    };

    this.conversationStore.update(user.id, sessionId, idleConversationState());

    return {
      status: 'needs_confirmation',
      response: `Create interview for ${candidateName} using "${template.name}" (${questions.length} questions)? Reply yes to confirm.`,
      suggestedQuestions: questions,
      pendingAction,
      pendingActionId: await this.pendingActionStore.issue(
        user.id,
        pendingAction,
      ),
    };
  }

  private async progressCreateInterviewFlow(
    input: {
      candidateName?: string;
      position?: string;
      slots?: Record<string, string>;
    },
    user: ActingUser,
    locale: Locale,
    sessionId: string,
    options: { persistFlowOnMissing: boolean },
  ): Promise<RecruiterAssistantResponseDto> {
    const slots: Record<string, string> = { ...(input.slots ?? {}) };
    if (input.candidateName && !slots.candidateName) {
      slots.candidateName = input.candidateName;
    }
    if (input.position && !slots.position) {
      slots.position = input.position;
    }

    if (slots.candidateChoice && !this.isCandidateResolved(slots)) {
      return this.resolveCandidateChoiceFromSlots(
        slots,
        user,
        locale,
        sessionId,
        options.persistFlowOnMissing,
      );
    }

    if (!this.isCandidateResolved(slots)) {
      if (slots.candidateName) {
        return this.resolveProvidedCandidateName(
          slots.candidateName,
          slots,
          user,
          locale,
          sessionId,
          options.persistFlowOnMissing,
        );
      }

      return this.requestCandidatePicker(
        user,
        sessionId,
        slots,
        options.persistFlowOnMissing,
      );
    }

    const candidateName = slots.candidateName;
    if (!candidateName) {
      return this.requestCandidatePicker(
        user,
        sessionId,
        slots,
        options.persistFlowOnMissing,
      );
    }

    const position = slots.position;
    if (!position) {
      return this.requestCreateInterviewPosition(
        user,
        sessionId,
        slots,
        options.persistFlowOnMissing,
      );
    }

    const templates = await this.findTemplatesForPosition(
      position,
      user,
      locale,
    );
    const templateFlowSlots = {
      candidateName,
      candidateId: slots.candidateId,
      candidateEmail: slots.candidateEmail,
      candidateResolution: slots.candidateResolution,
      position,
      templateIds: templates.map((template) => template.id).join(','),
    };

    if (templates.length === 0) {
      if (options.persistFlowOnMissing) {
        this.conversationStore.update(
          user.id,
          sessionId,
          idleConversationState(),
        );
      }
      return {
        status: 'answered',
        response: `No templates found for ${position}. Say "create my own" to open the interview form.`,
        redirect: this.buildCreateInterviewRedirect(slots),
      };
    }

    this.conversationStore.update(user.id, sessionId, {
      flow: 'create_interview',
      slots: templateFlowSlots,
      awaitingInput: 'templateChoice',
    });

    return {
      status: 'answered',
      response: `Found ${templates.length} template(s) for ${position}. Choose a number or say "create my own".`,
      templates,
      awaitingInput: 'templateChoice',
    };
  }

  private buildCreateInterviewRedirect(
    slots: Record<string, string>,
  ): RecruiterAssistantRedirectDto {
    return buildInterviewRedirect({
      candidateName: slots.candidateName,
      candidateEmail: slots.candidateEmail,
      position: slots.position,
    });
  }

  private isCandidateResolved(slots: Record<string, string>): boolean {
    return (
      slots.candidateResolution === 'registered' ||
      slots.candidateResolution === 'new'
    );
  }

  private registeredCandidateSlots(
    candidate: CandidateSummary,
  ): Record<string, string> {
    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      candidateResolution: 'registered',
    };
  }

  private stripTransientCandidateSlots(
    slots: Record<string, string>,
  ): Record<string, string> {
    const {
      candidateChoice: _candidateChoice,
      matchedCandidateId: _matchedCandidateId,
      matchedCandidateName: _matchedCandidateName,
      matchedCandidateEmail: _matchedCandidateEmail,
      ...rest
    } = slots;
    return rest;
  }

  private withCandidatePickerMetadata(
    slots: Record<string, string>,
    candidates: CandidateSummary[],
    searchQuery?: string,
  ): Record<string, string> {
    return {
      ...slots,
      candidateIds: candidates.map((candidate) => candidate.id).join(','),
      ...(searchQuery !== undefined
        ? { candidateSearchQuery: searchQuery }
        : {}),
    };
  }

  private async loadPickerCandidates(
    user: ActingUser,
    slots: Record<string, string>,
  ): Promise<CandidateSummary[]> {
    const searchQuery = slots.candidateSearchQuery;
    const candidates = await this.fetchCandidates(
      user,
      searchQuery || undefined,
    );
    const ids = new Set((slots.candidateIds ?? '').split(',').filter(Boolean));
    if (ids.size === 0) {
      return candidates;
    }
    return candidates.filter((candidate) => ids.has(candidate.id));
  }

  private async requestCandidatePicker(
    user: ActingUser,
    sessionId: string,
    slots: Record<string, string>,
    persist: boolean,
    options?: { candidates?: CandidateSummary[]; message?: string },
  ): Promise<RecruiterAssistantResponseDto> {
    const searchQuery = slots.candidateSearchQuery ?? slots.candidateName ?? '';
    const candidates =
      options?.candidates ??
      (await this.fetchCandidates(user, searchQuery || undefined));
    const nextSlots = this.withCandidatePickerMetadata(
      this.stripTransientCandidateSlots(slots),
      candidates,
      searchQuery,
    );
    const cleanedSlots = Object.fromEntries(
      Object.entries(nextSlots).filter(([, value]) => value),
    );

    if (persist) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow(
          'create_interview',
          'candidateChoice',
          cleanedSlots,
        ),
      );
    }

    return {
      status: 'answered',
      response:
        options?.message ??
        'Pick a registered candidate or type a new candidate name.',
      awaitingInput: 'candidateChoice',
      candidates,
    };
  }

  private requestRegisteredCandidateConfirm(
    user: ActingUser,
    sessionId: string,
    slots: Record<string, string>,
    candidate: CandidateSummary,
    persist: boolean,
  ): RecruiterAssistantResponseDto {
    const nextSlots = this.withCandidatePickerMetadata(
      slots,
      [candidate],
      slots.candidateName,
    );
    const cleanedSlots = Object.fromEntries(
      Object.entries(nextSlots).filter(([, value]) => value),
    );

    if (persist) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow(
          'create_interview',
          'confirmRegisteredCandidate',
          cleanedSlots,
        ),
      );
    }

    return {
      status: 'answered',
      response: `Use registered candidate ${candidate.name} (${candidate.email})? Reply yes or no.`,
      awaitingInput: 'confirmRegisteredCandidate',
      candidates: [candidate],
    };
  }

  private async resolveProvidedCandidateName(
    candidateName: string,
    slots: Record<string, string>,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
    persist: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    const candidates = await this.fetchCandidates(user, candidateName);
    const matches = this.findMatchingCandidates(candidates, candidateName);

    if (matches.length === 0) {
      return this.progressCreateInterviewFlow(
        {
          slots: {
            ...this.stripTransientCandidateSlots(slots),
            candidateName,
            candidateResolution: 'new',
          },
        },
        user,
        locale,
        sessionId,
        { persistFlowOnMissing: persist },
      );
    }

    if (matches.length === 1) {
      return this.requestRegisteredCandidateConfirm(
        user,
        sessionId,
        {
          ...this.stripTransientCandidateSlots(slots),
          candidateName,
          matchedCandidateId: matches[0].id,
          matchedCandidateName: matches[0].name,
          matchedCandidateEmail: matches[0].email,
        },
        matches[0],
        persist,
      );
    }

    return this.requestCandidatePicker(
      user,
      sessionId,
      { ...this.stripTransientCandidateSlots(slots), candidateName },
      persist,
      {
        candidates: matches,
        message: `Found ${matches.length} registered candidates matching "${candidateName}". Pick one or type a new name.`,
      },
    );
  }

  private async resolveCandidateChoiceFromSlots(
    slots: Record<string, string>,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
    persist: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    const choice = parseCandidateChoice(slots.candidateChoice ?? '');
    const baseSlots = this.stripTransientCandidateSlots(slots);

    if (!choice) {
      return this.requestCandidatePicker(user, sessionId, baseSlots, persist, {
        message:
          'Pick a registered candidate from the list or type a new candidate name.',
      });
    }

    if (choice.kind === 'new') {
      return this.progressCreateInterviewFlow(
        {
          slots: {
            ...baseSlots,
            candidateName: choice.name,
            candidateResolution: 'new',
          },
        },
        user,
        locale,
        sessionId,
        { persistFlowOnMissing: persist },
      );
    }

    const pickerCandidates = await this.loadPickerCandidates(user, slots);
    const selected = pickerCandidates.find(
      (candidate) => candidate.id === choice.id,
    );
    if (!selected) {
      return this.requestCandidatePicker(user, sessionId, baseSlots, persist, {
        message:
          'That candidate is not in the list. Pick one from the list or type a new name.',
      });
    }

    return this.progressCreateInterviewFlow(
      {
        slots: {
          ...baseSlots,
          ...this.registeredCandidateSlots(selected),
        },
      },
      user,
      locale,
      sessionId,
      { persistFlowOnMissing: persist },
    );
  }

  private requestCreateInterviewPosition(
    user: ActingUser,
    sessionId: string,
    slots: Record<string, string>,
    persist: boolean,
  ): RecruiterAssistantResponseDto {
    const cleanedSlots = Object.fromEntries(
      Object.entries(slots).filter(([, value]) => value),
    );

    if (persist) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('create_interview', 'position', cleanedSlots),
      );
    }

    return {
      status: 'answered',
      response: 'What position is the interview for?',
      awaitingInput: 'position',
    };
  }

  private async findTemplatesForPosition(
    position: string,
    user: ActingUser,
    locale: Locale,
  ): Promise<TemplateSummary[]> {
    const all = await this.templateService.findAll(locale, { demo: user.demo });
    const needle = position.trim().toLowerCase();
    return all.filter((template) =>
      (template.position ?? '').trim().toLowerCase().includes(needle),
    );
  }

  private async loadStoredTemplates(
    slots: Record<string, string>,
    user: ActingUser,
    locale: Locale,
  ): Promise<TemplateSummary[]> {
    const position = slots.position;
    if (!position) {
      return [];
    }
    const templates = await this.findTemplatesForPosition(
      position,
      user,
      locale,
    );
    const ids = new Set((slots.templateIds ?? '').split(',').filter(Boolean));
    return templates.filter((template) => ids.has(template.id));
  }

  private async progressCreateQuestionFlow(
    questionName: string,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    const matches = await this.questionMatcher.findSimilarMatchesOverThreshold(
      questionName,
      user,
      locale,
    );

    if (matches.length > 0) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('create_question', 'confirmAddDespiteSimilar', {
          questionName,
        }),
      );
      return {
        status: 'answered',
        response: `Found ${matches.length} similar question(s) (≥80%). Still add "${questionName}"? Reply yes to continue or no to abort.`,
        similarQuestions: buildSimilarQuestionMatchCards(matches),
        awaitingInput: 'confirmAddDespiteSimilar',
      };
    }

    return this.progressCreateQuestionDraftAndConfirm(
      questionName,
      user,
      locale,
      sessionId,
    );
  }

  private async progressCreateQuestionDraftAndConfirm(
    questionName: string,
    user: ActingUser,
    locale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    try {
      const draft = await this.aiService.draftQuestion(
        { questionText: questionName, role: 'General' },
        { headerLocale: locale, bodyLocale: locale },
      );

      if (!isQuestionDraftGenerate(draft)) {
        return {
          status: 'refused',
          response: 'I could not generate AI suggestions for that question.',
        };
      }

      const createQuestion = mapDraftGenerateToCreateQuestionDto(draft, locale);
      const pendingAction: RecruiterAssistantCreateSingleQuestionPendingActionDto =
        {
          type: 'create_single_question',
          questionName,
          createQuestion,
        };

      this.conversationStore.update(
        user.id,
        sessionId,
        idleConversationState(),
      );

      return {
        status: 'needs_confirmation',
        response: `Create question "${questionName}" with AI suggestions? Reply yes to confirm.`,
        pendingAction,
        pendingActionId: await this.pendingActionStore.issue(
          user.id,
          pendingAction,
        ),
      };
    } catch {
      return {
        status: 'refused',
        response:
          'Question draft generation failed. Try again or create the question manually.',
      };
    }
  }

  private async progressAssignHrFlow(
    input: {
      interviewRef: InterviewRef;
      hrRef: HrRef;
      slots?: Record<string, string>;
    },
    user: ActingUser,
    sessionId: string,
    options: { persistFlowOnMissing: boolean },
  ): Promise<RecruiterAssistantResponseDto> {
    const actor = toInterviewActor(user);
    const interviewRef = this.interviewRefFromAssignInput(input);
    const hrRef = this.hrRefFromAssignInput(input);
    const hasInterviewInput = !!(
      interviewRef.interviewId || interviewRef.candidateName
    );
    const hasHrInput = !!(hrRef.id || hrRef.name);

    const interview = hasInterviewInput
      ? await resolveInterviewRef(this.interviewService, interviewRef, actor)
      : null;
    const hrUser = hasHrInput
      ? await resolveHrRef(this.userService, hrRef, user.demo)
      : null;

    if (!hasInterviewInput && !hasHrInput) {
      return this.requestAssignHrSlot(
        user,
        sessionId,
        'interview',
        {},
        options.persistFlowOnMissing,
      );
    }

    if (hasInterviewInput && !interview) {
      return this.requestAssignHrSlot(
        user,
        sessionId,
        'interview',
        this.hrSlotsFromUser(hrUser),
        options.persistFlowOnMissing,
        true,
      );
    }

    if (interview && !hasHrInput) {
      return this.requestAssignHrSlot(
        user,
        sessionId,
        'hr',
        {
          interviewId: interview.id,
          interviewRef: interview.candidateName,
        },
        options.persistFlowOnMissing,
      );
    }

    if (interview && hasHrInput && !hrUser) {
      return this.requestAssignHrSlot(
        user,
        sessionId,
        'hr',
        {
          interviewId: interview.id,
          interviewRef: interview.candidateName,
        },
        options.persistFlowOnMissing,
        true,
      );
    }

    if (!interview || !hrUser) {
      return this.requestAssignHrSlot(
        user,
        sessionId,
        'interview',
        this.hrSlotsFromUser(hrUser),
        options.persistFlowOnMissing,
      );
    }

    this.conversationStore.update(user.id, sessionId, idleConversationState());
    return this.buildAssignHrConfirmation(interview, hrUser, user);
  }

  private interviewRefFromAssignInput(input: {
    interviewRef: InterviewRef;
    slots?: Record<string, string>;
  }): InterviewRef {
    if (input.interviewRef.interviewId || input.interviewRef.candidateName) {
      return input.interviewRef;
    }
    if (input.slots?.interviewId) {
      return { interviewId: input.slots.interviewId };
    }
    const slot = input.slots?.interviewRef;
    if (!slot) {
      return {};
    }
    return this.isUuid(slot) ? { interviewId: slot } : { candidateName: slot };
  }

  private hrRefFromAssignInput(input: {
    hrRef: HrRef;
    slots?: Record<string, string>;
  }): HrRef {
    if (input.hrRef.id || input.hrRef.name) {
      return input.hrRef;
    }
    if (input.slots?.assignedHrId) {
      return { id: input.slots.assignedHrId };
    }
    const hrName = input.slots?.hrName;
    if (!hrName) {
      return {};
    }
    return this.isUuid(hrName) ? { id: hrName } : { name: hrName };
  }

  private hrSlotsFromUser(
    hrUser: { id: string; name: string } | null,
  ): Record<string, string> {
    if (!hrUser) {
      return {};
    }
    return {
      hrName: hrUser.name,
      assignedHrId: hrUser.id,
    };
  }

  private async fetchAvailableHrs(user: ActingUser): Promise<AssignedHrDto[]> {
    const hrUsers = await this.userService.listAll({
      role: 'hr',
      demo: user.demo,
      limit: MAX_RECRUITER_ASSISTANT_HR_LIST_LIMIT,
    });
    return hrUsers.map((hrUser) => ({
      id: hrUser.id,
      name: hrUser.name,
      email: hrUser.email,
    }));
  }

  private async fetchUnassignedInterviews(user: ActingUser) {
    const { items } = await this.interviewService.findAllPaginated(
      {
        assignedHrId: ASSIGNED_HR_FILTER_UNASSIGNED,
        limit: MAX_INTERVIEWS_LIMIT,
      },
      toInterviewActor(user),
    );
    return items;
  }

  private async requestAssignHrSlot(
    user: ActingUser,
    sessionId: string,
    awaitingInput: 'hr' | 'interview',
    slots: Record<string, string>,
    persist: boolean,
    ambiguous = false,
  ): Promise<RecruiterAssistantResponseDto> {
    if (persist) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('assign_hr', awaitingInput, slots),
      );
    }

    if (awaitingInput === 'interview') {
      const interviews = await this.fetchUnassignedInterviews(user);
      if (interviews.length === 0) {
        this.conversationStore.update(
          user.id,
          sessionId,
          idleConversationState(),
        );
        return {
          status: 'answered',
          response: 'No unassigned interviews available.',
          interviews: [],
        };
      }

      return {
        status: 'answered',
        response: ambiguous
          ? "Couldn't detect singular interview, please choose from the list"
          : 'Which interview should I assign?',
        awaitingInput,
        interviews,
      };
    }

    const hrs = await this.fetchAvailableHrs(user);
    if (hrs.length === 0) {
      this.conversationStore.update(
        user.id,
        sessionId,
        idleConversationState(),
      );
      return {
        status: 'answered',
        response: 'No HR reviewers available.',
        hrs: [],
      };
    }

    return {
      status: 'answered',
      response: ambiguous
        ? "Couldn't detect singular HR, please choose from the list"
        : 'Which HR reviewer should I assign?',
      awaitingInput,
      hrs,
    };
  }

  private async buildAssignHrConfirmation(
    interview: { id: string; candidateName: string; position: string },
    hrUser: { id: string; name: string },
    user: ActingUser,
  ): Promise<RecruiterAssistantResponseDto> {
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
      pendingActionId: await this.pendingActionStore.issue(
        user.id,
        pendingAction,
      ),
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async fetchCandidates(
    user: ActingUser,
    query?: string,
  ): Promise<CandidateSummary[]> {
    return this.userService.searchCandidates(
      { demo: user.demo },
      query,
      MAX_RECRUITER_ASSISTANT_CANDIDATE_LIST_LIMIT,
    );
  }

  private findMatchingCandidates(
    candidates: CandidateSummary[],
    name: string,
  ): CandidateSummary[] {
    return findMatchingCandidatesByName(candidates, name);
  }

  private questionCountListFilters(
    filters: QueryQuestionsDto,
  ): QueryQuestionsDto {
    const { limit, page, includeTranslations, ...listFilters } = filters;
    void limit;
    void page;
    void includeTranslations;
    return listFilters;
  }

  private assessmentCountListFilters(
    filters: QueryAssessmentsFilters,
  ): QueryAssessmentsFilters {
    const listFilters: QueryAssessmentsFilters = {};
    if (filters.status && filters.status !== 'all') {
      listFilters.status = filters.status;
    }
    if (filters.q) {
      listFilters.q = filters.q;
    }
    return listFilters;
  }

  private async fetchAssessmentInterviews(
    user: ActingUser,
  ): Promise<{ items: InterviewListItem[]; truncated: boolean }> {
    const actor = toInterviewActor(user);
    const items: InterviewListItem[] = [];
    let page = 1;
    let total = 0;
    let truncated = false;

    do {
      const response = await this.interviewService.findAllPaginated(
        {
          page,
          limit: MAX_INTERVIEWS_LIMIT,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        },
        actor,
      );
      total = response.total;
      items.push(...response.items);
      if (response.items.length === 0) {
        break;
      }
      page += 1;
      if (page > MAX_ASSESSMENT_SCAN_PAGES && items.length < total) {
        truncated = true;
        this.logger.warn(
          `Assessment scan capped at ${MAX_ASSESSMENT_SCAN_PAGES} pages (${items.length}/${total} interviews). ` +
            'Review-status filtering is in-memory; add SQL-backed assessment facets for exact large-org counts.',
        );
        break;
      }
    } while (items.length < total);

    return { items, truncated };
  }

  private async findCandidateOwnInterview(user: ActingUser) {
    const interviews = await loadAllCandidateInterviews(
      this.interviewService,
      user,
    );
    const resolved = resolveLatestInterview(interviews);
    return resolved.kind === 'found' ? resolved.interview : null;
  }

  private async getCandidateReviewState(
    user: ActingUser,
    ref: InterviewRef,
  ): Promise<RecruiterAssistantResponseDto> {
    const interview = await this.findCandidateOwnInterview(user);
    if (!interview) {
      return {
        status: 'answered',
        response: 'You do not have an interview yet.',
      };
    }

    if (ref.interviewId || ref.candidateName) {
      const idMismatch =
        ref.interviewId != null && ref.interviewId !== interview.id;
      const nameMismatch =
        ref.candidateName != null &&
        scorePersonNameMatch(interview.candidateName, ref.candidateName) < 60;

      if (idMismatch || nameMismatch) {
        return {
          status: 'answered',
          response:
            'You can only check the review state of your own interview.',
        };
      }
    }

    const feedback = await this.candidateFeedbackService.findByInterviewId(
      interview.id,
    );
    const shareLinkActive =
      await this.candidateFeedbackShareService.hasActiveShareLink(interview.id);

    const reviewed =
      interview.status === 'completed' &&
      (!!interview.decision ||
        !!feedback?.outcome ||
        (feedback != null &&
          hasAnyPublishableCandidateFeedbackBlock(feedback)));

    const reviewState = {
      reviewed,
      shareLinkActive,
      outcome: feedback?.outcome ?? interview.decision,
    };

    const response = reviewed
      ? `Your interview has been reviewed${reviewState.outcome ? ` (${reviewState.outcome})` : ''}.`
      : 'Your interview has not been reviewed yet.';

    return {
      status: 'answered',
      response,
      interview: {
        id: interview.id,
        candidateName: interview.candidateName,
        position: interview.position,
        status: interview.status,
        reviewState,
      },
    };
  }
}
