import { Injectable, Logger } from '@nestjs/common';

import { RecruiterAssistantConfigService } from '../../app-config/recruiter-assistant-config.service';
import { AuthService } from '../../auth/auth.service';
import { CandidateFeedbackShareService } from '../../feedback/candidate-feedback-share.service';
import { CandidateFeedbackService } from '../../feedback/candidate-feedback.service';
import { hasAnyPublishableCandidateFeedbackBlock } from '../../feedback/present-public-candidate-feedback';
import { ASSIGNED_HR_FILTER_UNASSIGNED } from '../../interview/assigned-hr-filter';
import { AssignedHrDto } from '../../interview/dto/interview.responses.dto';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { InterviewListItem } from '../../interview/interfaces/interview.interface';
import { toInterviewActor } from '../../interview/interview-actor';
import { isTerminalInterviewStatus } from '../../interview/interview-management-rules';
import {
  isActiveInterviewStatus,
  sortInterviewsByCandidateRelevance,
} from '../../interview/interview-portal-relevance';
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
  filterActiveInterviews,
  loadAllCandidateInterviews,
  resolveCandidateOwnInterview,
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
import {
  buildCandidateActiveInterviewsResponseText,
  buildCandidateAllInterviewsResponseText,
  buildCandidateAmbiguousPositionResponseText,
  buildCandidateContinueUrl,
  buildCandidateInterviewSummary,
  buildCandidateNoInterviewsResponseText,
  buildCandidatePortalInterviewRedirect,
  buildCandidatePortalRedirect,
  buildCandidateReviewResponseText,
  buildCandidateStatusResponseText,
  buildCandidateUnknownPositionResponseText,
  formatCandidateInterviewStatusLabel,
} from './recruiter-assistant-candidate-response-builders';
import { resolveHrRef } from './recruiter-assistant-hr-ref';
import { assistantMessage as msg } from './recruiter-assistant-i18n';
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
  canListInterviews,
  canListTeam,
  newChatWelcomeResponse,
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
    private readonly authService: AuthService,
  ) {}

  async listInterviews(
    filters: QueryInterviewsDto,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    readyForReview?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.listInterviews'),
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
          ? msg(messageLocale, 'answered.noInterviewsReadyForReview')
          : msg(messageLocale, 'answered.noInterviewsMatched'),
        interviews: [],
      };
    }

    return {
      status: 'answered',
      response: msg(messageLocale, 'answered.interviewsFound', {
        total,
        count: items.length,
      }),
      interviews: items,
    };
  }

  listUnassigned(
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    return this.listInterviews(
      { assignedHrId: ASSIGNED_HR_FILTER_UNASSIGNED, limit: 20 },
      user,
      locale,
      messageLocale,
    );
  }

  async countQuestions(
    filters: QueryQuestionsDto,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canReadQuestions(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.readQuestions'),
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
        ? msg(messageLocale, 'answered.questionsCountFiltered', { total })
        : msg(messageLocale, 'answered.questionsCountTotal', { total }),
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
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.readAssessments'),
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
      ? msg(messageLocale, 'answered.assessmentsTruncatedNote', { scanLimit })
      : '';

    return {
      status: 'answered',
      response: hasFilters
        ? msg(messageLocale, 'answered.assessmentsCountFiltered', {
            total,
            truncatedNote,
          })
        : msg(messageLocale, 'answered.assessmentsCountTotal', {
            total,
            truncatedNote,
          }),
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
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.summarizeActivity'),
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
      response: msg(messageLocale, 'answered.activitySummary', {
        total: interviewActivity.total,
        active: interviewActivity.active,
        completed: interviewActivity.completed,
        failed: interviewActivity.failed,
      }),
      interviewActivity,
    };
  }

  async listTeam(
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    options: { role?: UserRole; includeSummary: boolean },
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canListTeam(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.listTeam'),
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
        response: msg(messageLocale, 'answered.noTeamMembers'),
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
      response: msg(messageLocale, 'answered.teamMembersListed', {
        summaryLine,
        count: teamMembers.length,
        roleLabel,
      }),
      teamSummary,
      teamMembers,
    };
  }

  async listHrs(
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canAssignHr(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.listHrs'),
        escalateTo: 'admin',
      };
    }

    const hrs = await this.fetchAvailableHrs(user);
    if (hrs.length === 0) {
      return {
        status: 'answered',
        response: msg(messageLocale, 'answered.noHrs'),
        hrs: [],
      };
    }

    return {
      status: 'answered',
      response: msg(messageLocale, 'answered.hrsFound', { count: hrs.length }),
      hrs,
    };
  }

  async listOwnInterviews(
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    activeOnly?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (user.role !== 'candidate') {
      return {
        status: 'refused',
        response: msg(messageLocale, 'denied.candidatesOnly'),
      };
    }

    const allInterviews = await loadAllCandidateInterviews(
      this.interviewService,
      user,
    );
    const listedInterviews = activeOnly
      ? filterActiveInterviews(allInterviews)
      : sortInterviewsByCandidateRelevance(allInterviews);

    const response = activeOnly
      ? buildCandidateActiveInterviewsResponseText(
          messageLocale,
          listedInterviews,
        )
      : buildCandidateAllInterviewsResponseText(
          messageLocale,
          listedInterviews,
        );

    return {
      status: 'answered',
      response,
      interviews: listedInterviews,
      redirect: buildCandidatePortalRedirect(),
    };
  }

  async getInterviewStatus(
    ref: InterviewRef,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    ownInterviews?: boolean,
    scheduleInquiry?: boolean,
    latest?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (ownInterviews) {
      if (user.role !== 'candidate') {
        return {
          status: 'refused',
          response: msg(messageLocale, 'denied.candidatesOnly'),
        };
      }

      return this.getCandidateInterviewStatus(
        user,
        ref,
        messageLocale,
        scheduleInquiry,
        latest,
      );
    }

    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.lookupStatus'),
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
        response: msg(messageLocale, 'answered.interviewNotFound'),
      };
    }

    return {
      status: 'answered',
      response: msg(messageLocale, 'answered.interviewStatus', {
        candidateName: interview.candidateName,
        position: interview.position,
        status: interview.status.replace('_', ' '),
      }),
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
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;

    if (user.role === 'candidate') {
      return this.getCandidateReviewState(user, ref, messageLocale);
    }

    if (!canListInterviews(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.checkReview'),
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
        response: msg(messageLocale, 'answered.interviewNotFound'),
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

    const outcome = reviewState.outcome ? ` (${reviewState.outcome})` : '';
    const response = reviewed
      ? msg(messageLocale, 'answered.interviewReviewed', {
          candidateName: interview.candidateName,
          outcome,
        })
      : msg(messageLocale, 'answered.interviewNotReviewed', {
          candidateName: interview.candidateName,
        });

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
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canAssignHr(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.assignHr'),
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
      messageLocale,
      { persistFlowOnMissing: true },
    );
  }

  async prepareCreateQuestion(
    questionName: string | undefined,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateQuestions(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.createQuestions'),
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    if (!questionName) {
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow('create_question', 'questionName'),
        messageLocale,
      });
      return {
        status: 'answered',
        response: msg(messageLocale, 'flow.askQuestionName'),
        awaitingInput: 'questionName',
      };
    }

    return this.progressCreateQuestionFlow(
      questionName,
      user,
      locale,
      messageLocale,
      sessionId,
    );
  }

  async prepareCreateQuestions(
    parsed: ParsedRecruiterRequest,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canReadQuestions(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.readQuestionsForPrep'),
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
        messageLocale,
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
    messageLocale: Locale,
  ): RecruiterAssistantResponseDto {
    void locale;
    if (!requestedLocale) {
      return {
        status: 'refused',
        response: rawToken
          ? msg(messageLocale, 'locale.unsupported', { token: rawToken })
          : msg(messageLocale, 'locale.switchHint'),
      };
    }

    return {
      status: 'answered',
      response: msg(messageLocale, 'locale.switched', {
        locale: requestedLocale,
      }),
      locale: requestedLocale,
    };
  }

  startNewChat(
    user: ActingUser,
    messageLocale: Locale,
  ): RecruiterAssistantResponseDto {
    return {
      status: 'answered',
      response: newChatWelcomeResponse(user, messageLocale),
    };
  }

  async continueAssignHrFlow(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    void locale;
    if (!canAssignHr(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.assignHr'),
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
      messageLocale ?? state.messageLocale ?? locale,
      { persistFlowOnMissing: true },
    );
  }

  async continueCreateQuestionFlow(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateQuestions(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.createQuestions'),
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const questionName = state.slots.questionName;
    if (!questionName) {
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow('create_question', 'questionName'),
        messageLocale: messageLocale ?? state.messageLocale ?? locale,
      });
      return {
        status: 'answered',
        response: msg(messageLocale, 'flow.askQuestionName'),
        awaitingInput: 'questionName',
      };
    }

    return this.progressCreateQuestionFlow(
      questionName,
      user,
      locale,
      messageLocale,
      sessionId,
    );
  }

  async continueCreateQuestionDespiteSimilar(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateQuestions(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.createQuestions'),
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const questionName = state.slots.questionName;
    if (!questionName) {
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow('create_question', 'questionName'),
        messageLocale: messageLocale ?? state.messageLocale ?? locale,
      });
      return {
        status: 'answered',
        response: msg(messageLocale, 'flow.askQuestionName'),
        awaitingInput: 'questionName',
      };
    }

    const response = await this.progressCreateQuestionDraftAndConfirm(
      questionName,
      user,
      locale,
      messageLocale,
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
        this.conversationStore.update(user.id, sessionId, {
          ...startConversationFlow(
            'create_question',
            'confirmAddDespiteSimilar',
            {
              questionName,
            },
          ),
          messageLocale: messageLocale ?? state.messageLocale ?? locale,
        });
        return {
          status: 'answered',
          response: msg(messageLocale, 'flow.similarQuestionsRetry', {
            previousMessage: response.response,
          }),
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
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    const questionName = state.slots.questionName;
    if (!questionName) {
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow('create_question', 'questionName'),
        messageLocale: messageLocale ?? state.messageLocale ?? locale,
      });
      return {
        status: 'answered',
        response: msg(messageLocale, 'flow.askQuestionName'),
        awaitingInput: 'questionName',
      };
    }

    const matches = await this.questionMatcher.findSimilarMatchesOverThreshold(
      questionName,
      user,
      locale,
    );

    this.conversationStore.update(user.id, sessionId, {
      ...startConversationFlow('create_question', 'confirmAddDespiteSimilar', {
        questionName,
      }),
      messageLocale: messageLocale ?? state.messageLocale ?? locale,
    });

    return {
      status: 'answered',
      response: msg(messageLocale, 'flow.similarQuestionsReprompt'),
      awaitingInput: 'confirmAddDespiteSimilar',
      similarQuestions: buildSimilarQuestionMatchCards(matches),
    };
  }

  async prepareCreateInterview(
    candidateName: string | undefined,
    position: string | undefined,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateInterviews(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.createInterviews'),
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    return this.progressCreateInterviewFlow(
      { candidateName, position },
      user,
      locale,
      messageLocale,
      sessionId,
      { persistFlowOnMissing: true },
    );
  }

  async continueCreateInterviewRegisteredCandidateConfirm(
    state: RecruiterConversationState,
    message: string,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canCreateInterviews(user)) {
      return {
        status: 'denied',
        response: msg(messageLocale, 'denied.createInterviews'),
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    const confirmation = parseRegisteredCandidateConfirmation(message);
    if (!confirmation) {
      return this.repromptRegisteredCandidateConfirm(
        state,
        user,
        messageLocale,
        sessionId,
      );
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
      messageLocale,
      sessionId,
    );
  }

  repromptRegisteredCandidateConfirm(
    state: RecruiterConversationState,
    user: ActingUser,
    messageLocale: Locale,
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
      response: msg(messageLocale, 'flow.confirmRegisteredCandidate', {
        name: candidate.name,
        email: candidate.email,
      }),
      awaitingInput: 'confirmRegisteredCandidate',
      candidates: [candidate],
    };
  }

  async continueCreateInterviewFlow(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
    message?: string,
  ): Promise<RecruiterAssistantResponseDto> {
    const resolvedMessageLocale =
      messageLocale ?? state.messageLocale ?? locale;

    if (!canCreateInterviews(user)) {
      return {
        status: 'denied',
        response: msg(resolvedMessageLocale, 'denied.createInterviews'),
        escalateTo: user.role === 'candidate' ? 'hr' : 'admin',
      };
    }

    if (state.awaitingInput === 'confirmRegisteredCandidate' && message) {
      return this.continueCreateInterviewRegisteredCandidateConfirm(
        state,
        message,
        user,
        locale,
        resolvedMessageLocale,
        sessionId,
      );
    }

    if (state.slots.candidateChoice && !this.isCandidateResolved(state.slots)) {
      return this.continueCreateInterviewCandidateChoice(
        state,
        user,
        locale,
        resolvedMessageLocale,
        sessionId,
      );
    }

    if (this.isCandidateResolved(state.slots) && state.slots.templateChoice) {
      return this.progressTemplateChoiceFlow(
        state.slots,
        user,
        locale,
        resolvedMessageLocale,
        sessionId,
      );
    }

    return this.progressCreateInterviewFlow(
      { slots: state.slots },
      user,
      locale,
      resolvedMessageLocale,
      sessionId,
      { persistFlowOnMissing: true },
    );
  }

  private async continueCreateInterviewCandidateChoice(
    state: RecruiterConversationState,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    return this.resolveCandidateChoiceFromSlots(
      state.slots,
      user,
      locale,
      messageLocale,
      sessionId,
      true,
    );
  }

  private async progressTemplateChoiceFlow(
    slots: Record<string, string>,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
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
        response: msg(messageLocale, 'flow.pickTemplate'),
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
        response: msg(messageLocale, 'flow.openInterviewForm'),
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
        response: msg(messageLocale, 'flow.templateOutOfRange', {
          index: choice.index,
          max: templates.length,
        }),
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
        response: msg(messageLocale, 'flow.templateNoQuestions', {
          templateName: template.name,
        }),
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
      response: msg(messageLocale, 'flow.createInterviewConfirm', {
        candidateName,
        templateName: template.name,
        questionCount: questions.length,
      }),
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
    messageLocale: Locale,
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
        messageLocale,
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
          messageLocale,
          sessionId,
          options.persistFlowOnMissing,
        );
      }

      return this.requestCandidatePicker(
        user,
        sessionId,
        slots,
        messageLocale,
        options.persistFlowOnMissing,
      );
    }

    const candidateName = slots.candidateName;
    if (!candidateName) {
      return this.requestCandidatePicker(
        user,
        sessionId,
        slots,
        messageLocale,
        options.persistFlowOnMissing,
      );
    }

    const position = slots.position;
    if (!position) {
      return this.requestCreateInterviewPosition(
        user,
        sessionId,
        slots,
        messageLocale,
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
        response: msg(messageLocale, 'flow.noTemplates', { position }),
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
      response: msg(messageLocale, 'flow.templatesFound', {
        count: templates.length,
        position,
      }),
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
    const rest = { ...slots };
    delete rest.candidateChoice;
    delete rest.matchedCandidateId;
    delete rest.matchedCandidateName;
    delete rest.matchedCandidateEmail;
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
    messageLocale: Locale,
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
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow(
          'create_interview',
          'candidateChoice',
          cleanedSlots,
        ),
        messageLocale,
      });
    }

    return {
      status: 'answered',
      response: options?.message ?? msg(messageLocale, 'flow.pickCandidate'),
      awaitingInput: 'candidateChoice',
      candidates,
    };
  }

  private requestRegisteredCandidateConfirm(
    user: ActingUser,
    sessionId: string,
    slots: Record<string, string>,
    candidate: CandidateSummary,
    messageLocale: Locale,
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
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow(
          'create_interview',
          'confirmRegisteredCandidate',
          cleanedSlots,
        ),
        messageLocale,
      });
    }

    return {
      status: 'answered',
      response: msg(messageLocale, 'flow.confirmRegisteredCandidate', {
        name: candidate.name,
        email: candidate.email,
      }),
      awaitingInput: 'confirmRegisteredCandidate',
      candidates: [candidate],
    };
  }

  private async resolveProvidedCandidateName(
    candidateName: string,
    slots: Record<string, string>,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
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
        messageLocale,
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
        messageLocale,
        persist,
      );
    }

    return this.requestCandidatePicker(
      user,
      sessionId,
      { ...this.stripTransientCandidateSlots(slots), candidateName },
      messageLocale,
      persist,
      {
        candidates: matches,
        message: msg(messageLocale, 'flow.candidatesMatching', {
          count: matches.length,
          name: candidateName,
        }),
      },
    );
  }

  private async resolveCandidateChoiceFromSlots(
    slots: Record<string, string>,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
    sessionId: string,
    persist: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    const choice = parseCandidateChoice(slots.candidateChoice ?? '');
    const baseSlots = this.stripTransientCandidateSlots(slots);

    if (!choice) {
      return this.requestCandidatePicker(
        user,
        sessionId,
        baseSlots,
        messageLocale,
        persist,
        {
          message: msg(messageLocale, 'flow.pickCandidateFromList'),
        },
      );
    }

    if (choice.kind === 'new') {
      return this.resolveProvidedCandidateName(
        choice.name,
        baseSlots,
        user,
        locale,
        messageLocale,
        sessionId,
        persist,
      );
    }

    const pickerCandidates = await this.loadPickerCandidates(user, slots);
    const selected = pickerCandidates.find(
      (candidate) => candidate.id === choice.id,
    );
    if (!selected) {
      return this.requestCandidatePicker(
        user,
        sessionId,
        baseSlots,
        messageLocale,
        persist,
        {
          message: msg(messageLocale, 'flow.candidateNotInList'),
        },
      );
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
      messageLocale,
      sessionId,
      { persistFlowOnMissing: persist },
    );
  }

  private requestCreateInterviewPosition(
    user: ActingUser,
    sessionId: string,
    slots: Record<string, string>,
    messageLocale: Locale,
    persist: boolean,
  ): RecruiterAssistantResponseDto {
    const cleanedSlots = Object.fromEntries(
      Object.entries(slots).filter(([, value]) => value),
    );

    if (persist) {
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow('create_interview', 'position', cleanedSlots),
        messageLocale,
      });
    }

    return {
      status: 'answered',
      response: msg(messageLocale, 'flow.askPosition'),
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
    messageLocale: Locale,
    sessionId: string,
  ): Promise<RecruiterAssistantResponseDto> {
    const matches = await this.questionMatcher.findSimilarMatchesOverThreshold(
      questionName,
      user,
      locale,
    );

    if (matches.length > 0) {
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow(
          'create_question',
          'confirmAddDespiteSimilar',
          {
            questionName,
          },
        ),
        messageLocale,
      });
      return {
        status: 'answered',
        response: msg(messageLocale, 'flow.similarQuestions', {
          count: matches.length,
          questionName,
        }),
        similarQuestions: buildSimilarQuestionMatchCards(matches),
        awaitingInput: 'confirmAddDespiteSimilar',
      };
    }

    return this.progressCreateQuestionDraftAndConfirm(
      questionName,
      user,
      locale,
      messageLocale,
      sessionId,
    );
  }

  private async progressCreateQuestionDraftAndConfirm(
    questionName: string,
    user: ActingUser,
    locale: Locale,
    messageLocale: Locale,
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
          response: msg(messageLocale, 'flow.questionDraftFailed'),
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
        response: msg(messageLocale, 'flow.createQuestionConfirm', {
          questionName,
        }),
        pendingAction,
        pendingActionId: await this.pendingActionStore.issue(
          user.id,
          pendingAction,
        ),
      };
    } catch {
      return {
        status: 'refused',
        response: msg(messageLocale, 'flow.questionDraftGenerationFailed'),
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
    messageLocale: Locale,
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
        messageLocale,
        options.persistFlowOnMissing,
      );
    }

    if (hasInterviewInput && !interview) {
      return this.requestAssignHrSlot(
        user,
        sessionId,
        'interview',
        this.hrSlotsFromUser(hrUser),
        messageLocale,
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
        messageLocale,
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
        messageLocale,
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
        messageLocale,
        options.persistFlowOnMissing,
      );
    }

    this.conversationStore.update(user.id, sessionId, idleConversationState());
    return this.buildAssignHrConfirmation(
      interview,
      hrUser,
      user,
      messageLocale,
    );
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
    messageLocale: Locale,
    persist: boolean,
    ambiguous = false,
  ): Promise<RecruiterAssistantResponseDto> {
    if (persist) {
      this.conversationStore.update(user.id, sessionId, {
        ...startConversationFlow('assign_hr', awaitingInput, slots),
        messageLocale,
      });
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
          response: msg(messageLocale, 'flow.noUnassignedInterviews'),
          interviews: [],
        };
      }

      return {
        status: 'answered',
        response: ambiguous
          ? msg(messageLocale, 'flow.assignInterviewAmbiguous')
          : msg(messageLocale, 'flow.assignInterviewPrompt'),
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
        response: msg(messageLocale, 'answered.noHrs'),
        hrs: [],
      };
    }

    return {
      status: 'answered',
      response: ambiguous
        ? msg(messageLocale, 'flow.assignHrAmbiguous')
        : msg(messageLocale, 'flow.assignHrPrompt'),
      awaitingInput,
      hrs,
    };
  }

  private async buildAssignHrConfirmation(
    interview: { id: string; candidateName: string; position: string },
    hrUser: { id: string; name: string },
    user: ActingUser,
    messageLocale: Locale,
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
      response: msg(messageLocale, 'flow.assignHrConfirm', {
        interviewLabel,
        hrName: hrUser.name,
      }),
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

  private async findCandidateOwnInterview(
    user: ActingUser,
    ref: InterviewRef = {},
    latest?: boolean,
  ) {
    const interviews = await loadAllCandidateInterviews(
      this.interviewService,
      user,
    );
    const resolved = resolveCandidateOwnInterview(interviews, ref, latest);
    return { resolved, interviews };
  }

  private async getCandidateInterviewStatus(
    user: ActingUser,
    ref: InterviewRef,
    messageLocale: Locale,
    scheduleInquiry?: boolean,
    latest?: boolean,
  ): Promise<RecruiterAssistantResponseDto> {
    const { resolved, interviews } = await this.findCandidateOwnInterview(
      user,
      ref,
      latest,
    );

    if (interviews.length === 0) {
      return {
        status: 'answered',
        response: buildCandidateNoInterviewsResponseText(messageLocale),
      };
    }

    if (resolved.kind === 'ambiguous') {
      return {
        status: 'answered',
        response: buildCandidateAmbiguousPositionResponseText(
          messageLocale,
          resolved.interviews,
        ),
        interviews: resolved.interviews,
      };
    }

    if (resolved.kind === 'not_found') {
      if (ref.position && !latest) {
        return {
          status: 'answered',
          response: buildCandidateUnknownPositionResponseText(
            messageLocale,
            ref.position,
            interviews,
          ),
          interviews,
        };
      }

      return {
        status: 'answered',
        response: buildCandidateNoInterviewsResponseText(messageLocale),
      };
    }

    const interview = resolved.interview;
    const resultsReady = isTerminalInterviewStatus(interview.status)
      ? await this.isCandidateResultsReady(interview.id)
      : false;
    const statusLabel = formatCandidateInterviewStatusLabel(
      messageLocale,
      interview.status,
      resultsReady,
    );
    const continueUrl = this.buildCandidateContinueUrl(interview);

    return {
      status: 'answered',
      response: buildCandidateStatusResponseText(
        messageLocale,
        interview,
        statusLabel,
        scheduleInquiry,
      ),
      interview: buildCandidateInterviewSummary(interview, { continueUrl }),
      redirect: buildCandidatePortalInterviewRedirect(interview.id),
    };
  }

  private async getCandidateReviewState(
    user: ActingUser,
    ref: InterviewRef,
    messageLocale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    const { resolved, interviews } = await this.findCandidateOwnInterview(
      user,
      ref,
    );

    if (interviews.length === 0) {
      return {
        status: 'answered',
        response: buildCandidateNoInterviewsResponseText(messageLocale),
      };
    }

    if (resolved.kind === 'ambiguous') {
      return {
        status: 'answered',
        response: buildCandidateAmbiguousPositionResponseText(
          messageLocale,
          resolved.interviews,
        ),
        interviews: resolved.interviews,
      };
    }

    if (resolved.kind === 'not_found') {
      if (ref.interviewId || ref.candidateName) {
        return {
          status: 'answered',
          response: msg(messageLocale, 'candidate.onlyOwnReview'),
        };
      }

      if (ref.position) {
        return {
          status: 'answered',
          response: buildCandidateUnknownPositionResponseText(
            messageLocale,
            ref.position,
            interviews,
          ),
          interviews,
        };
      }

      return {
        status: 'answered',
        response: buildCandidateNoInterviewsResponseText(messageLocale),
      };
    }

    const interview = resolved.interview;

    if (ref.interviewId && ref.interviewId !== interview.id) {
      return {
        status: 'answered',
        response: msg(messageLocale, 'candidate.onlyOwnReview'),
      };
    }

    if (ref.candidateName) {
      const nameMismatch =
        scorePersonNameMatch(interview.candidateName, ref.candidateName) < 60;
      if (nameMismatch) {
        return {
          status: 'answered',
          response: msg(messageLocale, 'candidate.onlyOwnReview'),
        };
      }
    }

    const feedback = await this.candidateFeedbackService.findByInterviewId(
      interview.id,
    );
    const shareLinkActive =
      await this.candidateFeedbackShareService.hasActiveShareLink(interview.id);
    const resultsReady = feedback
      ? hasAnyPublishableCandidateFeedbackBlock(feedback)
      : false;

    const reviewed =
      interview.status === 'completed' &&
      (!!interview.decision || !!feedback?.outcome || resultsReady);

    const reviewState = {
      reviewed,
      resultsReady,
      shareLinkActive,
      outcome: feedback?.outcome ?? interview.decision,
    };

    return {
      status: 'answered',
      response: buildCandidateReviewResponseText(
        messageLocale,
        interview,
        reviewed,
        reviewState.outcome,
      ),
      interview: buildCandidateInterviewSummary(interview, { reviewState }),
      redirect: buildCandidatePortalInterviewRedirect(interview.id),
    };
  }

  private async isCandidateResultsReady(interviewId: string): Promise<boolean> {
    const feedback =
      await this.candidateFeedbackService.findByInterviewId(interviewId);
    return feedback ? hasAnyPublishableCandidateFeedbackBlock(feedback) : false;
  }

  private buildCandidateContinueUrl(
    interview: InterviewListItem,
  ): string | undefined {
    if (!isActiveInterviewStatus(interview.status)) {
      return undefined;
    }

    const token = this.authService.generateCandidatePortalContinueToken(
      interview.id,
    );
    return buildCandidateContinueUrl(interview.id, token);
  }
}
