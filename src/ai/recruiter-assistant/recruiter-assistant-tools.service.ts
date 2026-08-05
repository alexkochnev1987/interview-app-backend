import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';
import { TemplateService } from '../../template/template.service';
import { TemplateSummary } from '../../template/template.service';
import { CandidateFeedbackService } from '../../feedback/candidate-feedback.service';
import { hasAnyPublishableCandidateFeedbackBlock } from '../../feedback/present-public-candidate-feedback';
import { Locale } from '../../locale/locale.constants';
import { ASSIGNED_HR_FILTER_UNASSIGNED } from '../../interview/assigned-hr-filter';
import { toInterviewActor } from '../../interview/interview-actor';
import { InterviewService } from '../../interview/interview.service';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { UserService } from '../../user/user.service';
import { CandidateFeedbackShareService } from '../../feedback/candidate-feedback-share.service';
import {
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantCreateSingleQuestionPendingActionDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import {
  canAssignHr,
  canCreateInterviews,
  canCreateQuestions,
  canReadQuestions,
  canListInterviews,
  NEW_CHAT_WELCOME_RESPONSE,
} from './recruiter-assistant.policy';
import { buildQuestionPlanResponse } from './recruiter-assistant-response';
import { buildInterviewRedirect } from './recruiter-assistant-response-builders';
import { parseTemplateChoice } from './recruiter-assistant-template-choice-parse';
import { resolveHrRef } from './recruiter-assistant-hr-ref';
import { resolveInterviewRef } from './recruiter-assistant-interview-ref';
import { scorePersonNameMatch } from './recruiter-assistant-name-match';
import {
  ActingUser,
  HrRef,
  InterviewRef,
  ParsedRecruiterRequest,
  RecruiterAssistantIntent,
} from './recruiter-assistant.types';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';
import { buildQuestionSuggestions } from './recruiter-question-plan';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterConversationState } from './recruiter-conversation.types';
import {
  idleConversationState,
  startConversationFlow,
} from './recruiter-conversation-slots';
import {
  isQuestionDraftGenerate,
  mapDraftGenerateToCreateQuestionDto,
} from './recruiter-question-draft.mapper';

/** User-facing assistant strings are English-only (see module known limitations). */
@Injectable()
export class RecruiterAssistantToolsService {
  constructor(
    private readonly questionMatcher: RecruiterQuestionMatcherService,
    private readonly interviewService: InterviewService,
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly candidateFeedbackShareService: CandidateFeedbackShareService,
    private readonly userService: UserService,
    private readonly pendingActionStore: RecruiterPendingActionStore,
    private readonly conversationStore: RecruiterConversationStore,
    private readonly aiService: AiService,
    private readonly templateService: TemplateService,
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
        return { status: 'refused', response: 'That question is only for candidates.' };
      }

      const interview = await this.findCandidateOwnInterview(user);
      if (!interview) {
        return { status: 'answered', response: 'You do not have an interview yet.' };
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
        response: 'I could not find a unique interview. Provide an interview id or candidate name.',
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

    const feedback = await this.candidateFeedbackService.findByInterviewId(interview.id);
    const shareLinkActive =
      await this.candidateFeedbackShareService.hasActiveShareLink(interview.id);

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

    return this.progressCreateQuestionFlow(questionName, user, locale, sessionId);
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
      pendingActionId: await this.pendingActionStore.issue(user.id, pendingAction),
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

    return this.progressCreateQuestionFlow(questionName, user, locale, sessionId);
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

  async continueCreateInterviewFlow(
    state: RecruiterConversationState,
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

    if (state.slots.templateChoice) {
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
      this.conversationStore.update(user.id, sessionId, idleConversationState());
      return {
        status: 'answered',
        response: 'Opening the interview form.',
        redirect: buildInterviewRedirect({ candidateName, position }),
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
      this.conversationStore.update(user.id, sessionId, idleConversationState());
      return {
        status: 'refused',
        response: `Template "${template.name}" has no available questions. Try another template or say "create my own".`,
        redirect: buildInterviewRedirect({ candidateName, position }),
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
      interviewLocale: locale,
      questions,
    };

    this.conversationStore.update(user.id, sessionId, idleConversationState());

    return {
      status: 'needs_confirmation',
      response: `Create interview for ${candidateName} using "${template.name}" (${questions.length} questions)? Reply yes to confirm.`,
      suggestedQuestions: questions,
      pendingAction,
      pendingActionId: await this.pendingActionStore.issue(user.id, pendingAction),
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
    const candidateName = input.candidateName ?? input.slots?.candidateName;
    const position = input.position ?? input.slots?.position;

    if (!candidateName) {
      return this.requestCreateInterviewSlot(
        user,
        sessionId,
        'candidateName',
        { position: position ?? '' },
        options.persistFlowOnMissing,
      );
    }

    if (!position) {
      return this.requestCreateInterviewSlot(
        user,
        sessionId,
        'position',
        { candidateName },
        options.persistFlowOnMissing,
      );
    }

    const templates = await this.findTemplatesForPosition(position, user, locale);
    const slots = {
      candidateName,
      position,
      templateIds: templates.map((template) => template.id).join(','),
    };

    if (templates.length === 0) {
      if (options.persistFlowOnMissing) {
        this.conversationStore.update(user.id, sessionId, idleConversationState());
      }
      return {
        status: 'answered',
        response: `No templates found for ${position}. Say "create my own" to open the interview form.`,
        redirect: buildInterviewRedirect({ candidateName, position }),
      };
    }

    this.conversationStore.update(user.id, sessionId, {
      flow: 'create_interview',
      slots,
      awaitingInput: 'templateChoice',
    });

    return {
      status: 'answered',
      response: `Found ${templates.length} template(s) for ${position}. Choose a number or say "create my own".`,
      templates,
      awaitingInput: 'templateChoice',
    };
  }

  private requestCreateInterviewSlot(
    user: ActingUser,
    sessionId: string,
    awaitingInput: 'candidateName' | 'position',
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
        startConversationFlow('create_interview', awaitingInput, cleanedSlots),
      );
    }

    return {
      status: 'answered',
      response:
        awaitingInput === 'candidateName'
          ? 'What is the candidate name?'
          : 'What position is the interview for?',
      awaitingInput,
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
    const templates = await this.findTemplatesForPosition(position, user, locale);
    const ids = new Set((slots.templateIds ?? '').split(',').filter(Boolean));
    return templates.filter((template) => ids.has(template.id));
  }

  private async progressCreateQuestionFlow(
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
      const pendingAction: RecruiterAssistantCreateSingleQuestionPendingActionDto = {
        type: 'create_single_question',
        questionName,
        createQuestion,
      };

      this.conversationStore.update(user.id, sessionId, idleConversationState());

      return {
        status: 'needs_confirmation',
        response: `Create question "${questionName}" with AI suggestions? Reply yes to confirm.`,
        pendingAction,
        pendingActionId: await this.pendingActionStore.issue(user.id, pendingAction),
      };
    } catch {
      return {
        status: 'refused',
        response: 'Question draft generation failed. Try again or create the question manually.',
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
    const hasInterviewInput = !!(interviewRef.interviewId || interviewRef.candidateName);
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
        'I could not find a unique interview. Provide a candidate name or interview id.',
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
        'I could not find a unique HR user. Provide an HR name.',
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
    return hrName ? { name: hrName } : {};
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

  private requestAssignHrSlot(
    user: ActingUser,
    sessionId: string,
    awaitingInput: 'hr' | 'interview',
    slots: Record<string, string>,
    persist: boolean,
    response?: string,
  ): RecruiterAssistantResponseDto {
    if (persist) {
      this.conversationStore.update(
        user.id,
        sessionId,
        startConversationFlow('assign_hr', awaitingInput, slots),
      );
    }

    return {
      status: 'answered',
      response:
        response
        ?? (awaitingInput === 'interview'
          ? 'Which interview should I assign? Provide a candidate name or interview id.'
          : 'Which HR reviewer should I assign?'),
      awaitingInput,
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
      pendingActionId: await this.pendingActionStore.issue(user.id, pendingAction),
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async findCandidateOwnInterview(user: ActingUser) {
    return this.interviewService.findLatestByCandidateEmail(user.email, user.demo);
  }

  private async getCandidateReviewState(
    user: ActingUser,
    ref: InterviewRef,
  ): Promise<RecruiterAssistantResponseDto> {
    const interview = await this.findCandidateOwnInterview(user);
    if (!interview) {
      return { status: 'answered', response: 'You do not have an interview yet.' };
    }

    if (ref.interviewId || ref.candidateName) {
      const idMismatch =
        ref.interviewId != null && ref.interviewId !== interview.id;
      const nameMismatch =
        ref.candidateName != null
        && scorePersonNameMatch(interview.candidateName, ref.candidateName) < 60;

      if (idMismatch || nameMismatch) {
        return {
          status: 'answered',
          response:
            'You can only check the review state of your own interview.',
        };
      }
    }

    const feedback = await this.candidateFeedbackService.findByInterviewId(interview.id);
    const shareLinkActive =
      await this.candidateFeedbackShareService.hasActiveShareLink(interview.id);

    const reviewed =
      interview.status === 'completed'
      && (
        !!interview.decision
        || !!feedback?.outcome
        || (feedback != null && hasAnyPublishableCandidateFeedbackBlock(feedback))
      );

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
