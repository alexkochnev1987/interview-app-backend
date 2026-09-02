import { Injectable } from '@nestjs/common';

import { RecruiterAssistantConfigService } from '../../app-config/recruiter-assistant-config.service';
import { Locale } from '../../locale/locale.constants';
import {
  RecruiterAssistantChatDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import { assistantMessage as msg } from './recruiter-assistant-i18n';
import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { resolveConversationLocale } from './recruiter-assistant-message-locale';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import {
  canAccessChat,
  isCancellationMessage,
  isConfirmationMessage,
  isConversationResetMessage,
  outOfScopeResponse,
  recruiterAssistantDisabledResponse,
} from './recruiter-assistant.policy';
import { ActingUser } from './recruiter-assistant.types';
import { RecruiterConversationFlowService } from './recruiter-conversation-flow.service';
import { idleConversationState } from './recruiter-conversation-slots';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterConversationState } from './recruiter-conversation.types';
import { RecruiterPendingActionExecutorService } from './recruiter-pending-action-executor.service';
import { applyPendingActionOverride } from './recruiter-pending-action-override';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';

@Injectable()
export class RecruiterAssistantService {
  constructor(
    private readonly intentRouter: RecruiterAssistantIntentService,
    private readonly tools: RecruiterAssistantToolsService,
    private readonly pendingActionExecutor: RecruiterPendingActionExecutorService,
    private readonly pendingActionStore: RecruiterPendingActionStore,
    private readonly conversationStore: RecruiterConversationStore,
    private readonly conversationFlow: RecruiterConversationFlowService,
    private readonly recruiterAssistantConfig: RecruiterAssistantConfigService,
  ) {}

  async chat(
    dto: RecruiterAssistantChatDto,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    const message = dto.message.trim();
    const headerMessageLocale = resolveConversationLocale(message, locale);

    if (
      !(await this.recruiterAssistantConfig.isRecruiterAssistantEnabledForRole(
        user.role,
      ))
    ) {
      const globallyEnabled =
        await this.recruiterAssistantConfig.isRecruiterAssistantEnabled();
      return {
        status: 'refused',
        response: recruiterAssistantDisabledResponse(
          !globallyEnabled,
          headerMessageLocale,
        ),
        locale: headerMessageLocale,
      };
    }

    if (!canAccessChat(user)) {
      return {
        status: 'refused',
        response: outOfScopeResponse(user, headerMessageLocale),
        locale: headerMessageLocale,
      };
    }

    if (isConversationResetMessage(message)) {
      return this.newChat(user, locale, message);
    }

    const intent = this.intentRouter.classify(message, user, locale);
    if (intent.kind === 'new_chat') {
      return this.newChat(user, locale, message);
    }

    let sessionId = dto.sessionId;
    if (!sessionId || !this.conversationStore.get(user.id, sessionId)) {
      sessionId = this.conversationStore.issue(user.id);
    }

    const conversationState =
      this.conversationStore.get(user.id, sessionId) ?? idleConversationState();
    const { messageLocale, state: stateWithLocale } = this.applyMessageLocale(
      user.id,
      sessionId,
      conversationState,
      message,
      locale,
    );

    if (dto.pendingActionId) {
      if (isConfirmationMessage(message)) {
        const action = await this.pendingActionStore.consume(
          user.id,
          dto.pendingActionId,
        );
        if (!action) {
          return this.withSession(
            {
              status: 'refused',
              response: msg(messageLocale, 'confirmationExpired'),
            },
            sessionId,
            messageLocale,
          );
        }

        let confirmedAction = action;
        if (dto.pendingAction) {
          const overridden = applyPendingActionOverride(
            action,
            dto.pendingAction,
          );
          if (!overridden) {
            return this.withSession(
              {
                status: 'refused',
                response: msg(messageLocale, 'confirmationApplyFailed'),
              },
              sessionId,
              messageLocale,
            );
          }
          confirmedAction = overridden;
        }

        return this.withSession(
          await this.pendingActionExecutor.execute(
            confirmedAction,
            user,
            locale,
            messageLocale,
          ),
          sessionId,
          messageLocale,
        );
      }

      if (isCancellationMessage(message)) {
        await this.pendingActionStore.revoke(user.id, dto.pendingActionId);
        return this.withSession(
          {
            status: 'answered',
            response: msg(messageLocale, 'cancelled'),
          },
          sessionId,
          messageLocale,
        );
      }
    }

    const activeFlowResponse = await this.conversationFlow.resumeActiveFlow({
      user,
      locale,
      messageLocale,
      sessionId,
      message,
      state: stateWithLocale,
    });
    if (activeFlowResponse) {
      return this.withSession(activeFlowResponse, sessionId, messageLocale);
    }

    switch (intent.kind) {
      case 'list_interviews':
        return this.withSession(
          await this.tools.listInterviews(
            intent.filters,
            user,
            locale,
            messageLocale,
            intent.readyForReview,
          ),
          sessionId,
          messageLocale,
        );
      case 'list_own_interviews':
        return this.withSession(
          await this.tools.listOwnInterviews(
            user,
            locale,
            messageLocale,
            intent.activeOnly,
          ),
          sessionId,
          messageLocale,
        );
      case 'list_unassigned':
        return this.withSession(
          await this.tools.listUnassigned(user, locale, messageLocale),
          sessionId,
          messageLocale,
        );
      case 'list_hrs':
        return this.withSession(
          await this.tools.listHrs(user, locale, messageLocale),
          sessionId,
          messageLocale,
        );
      case 'interview_status':
        return this.withSession(
          await this.tools.getInterviewStatus(
            intent.ref,
            user,
            locale,
            messageLocale,
            intent.ownInterviews,
            intent.scheduleInquiry,
            intent.latest,
          ),
          sessionId,
          messageLocale,
        );
      case 'review_state':
        return this.withSession(
          await this.tools.getReviewState(
            intent.ref,
            user,
            locale,
            messageLocale,
          ),
          sessionId,
          messageLocale,
        );
      case 'assign_hr':
        return this.withSession(
          await this.tools.prepareAssignHr(
            intent,
            user,
            locale,
            messageLocale,
            sessionId,
          ),
          sessionId,
          messageLocale,
        );
      case 'create_question':
        return this.withSession(
          await this.tools.prepareCreateQuestion(
            intent.questionName,
            user,
            locale,
            messageLocale,
            sessionId,
          ),
          sessionId,
          messageLocale,
        );
      case 'create_interview':
        return this.withSession(
          await this.tools.prepareCreateInterview(
            intent.candidateName,
            intent.position,
            user,
            locale,
            messageLocale,
            sessionId,
          ),
          sessionId,
          messageLocale,
        );
      case 'create_questions_interview':
        return this.withSession(
          await this.tools.prepareCreateQuestions(
            intent.parsed,
            user,
            locale,
            messageLocale,
          ),
          sessionId,
          messageLocale,
        );
      case 'switch_locale': {
        const switchResponse = this.tools.switchLocale(
          intent.requestedLocale,
          intent.rawToken,
          locale,
          messageLocale,
        );
        const switchedLocale = switchResponse.locale ?? messageLocale;
        if (switchResponse.locale) {
          this.conversationStore.update(user.id, sessionId, {
            ...stateWithLocale,
            messageLocale: switchedLocale,
          });
        }
        return this.withSession(switchResponse, sessionId, switchedLocale);
      }
      case 'count_questions':
        return this.withSession(
          await this.tools.countQuestions(
            intent.filters,
            user,
            locale,
            messageLocale,
          ),
          sessionId,
          messageLocale,
        );
      case 'list_assessments':
        return this.withSession(
          await this.tools.listAssessments(
            intent.filters,
            user,
            locale,
            messageLocale,
          ),
          sessionId,
          messageLocale,
        );
      case 'interview_activity_summary':
        return this.withSession(
          await this.tools.summarizeInterviewActivity(
            user,
            locale,
            messageLocale,
          ),
          sessionId,
          messageLocale,
        );
      case 'list_team':
        return this.withSession(
          await this.tools.listTeam(user, locale, messageLocale, {
            role: intent.role,
            includeSummary: intent.includeSummary,
          }),
          sessionId,
          messageLocale,
        );
      case 'out_of_scope':
        return this.withSession(
          {
            status: 'refused',
            response: outOfScopeResponse(user, messageLocale),
          },
          sessionId,
          messageLocale,
        );
    }
  }

  async newChat(
    user: ActingUser,
    headerLocale: Locale = 'en',
    message?: string,
  ): Promise<RecruiterAssistantResponseDto> {
    if (
      !(await this.recruiterAssistantConfig.isRecruiterAssistantEnabledForRole(
        user.role,
      ))
    ) {
      const globallyEnabled =
        await this.recruiterAssistantConfig.isRecruiterAssistantEnabled();
      return {
        status: 'refused',
        response: recruiterAssistantDisabledResponse(
          !globallyEnabled,
          headerLocale,
        ),
        locale: headerLocale,
      };
    }

    if (!canAccessChat(user)) {
      return {
        status: 'refused',
        response: outOfScopeResponse(user, headerLocale),
        locale: headerLocale,
      };
    }

    return this.resetConversation(user, headerLocale, message);
  }

  private async resetConversation(
    user: ActingUser,
    headerLocale: Locale,
    message?: string,
  ): Promise<RecruiterAssistantResponseDto> {
    this.conversationStore.clearAllForUser(user.id);
    await this.pendingActionStore.revokeAllForUser(user.id);
    const sessionId = this.conversationStore.issue(user.id);
    const messageLocale = resolveConversationLocale(
      message ?? '',
      headerLocale,
    );
    this.conversationStore.update(user.id, sessionId, {
      ...idleConversationState(),
      messageLocale,
    });
    return this.withSession(
      this.tools.startNewChat(user, messageLocale),
      sessionId,
      messageLocale,
    );
  }

  private applyMessageLocale(
    userId: string,
    sessionId: string,
    state: RecruiterConversationState,
    message: string,
    headerLocale: Locale,
  ): { messageLocale: Locale; state: RecruiterConversationState } {
    const messageLocale = resolveConversationLocale(
      message,
      headerLocale,
      state.messageLocale,
    );
    if (state.messageLocale === messageLocale) {
      return { messageLocale, state };
    }

    const nextState = { ...state, messageLocale };
    this.conversationStore.update(userId, sessionId, nextState);
    return { messageLocale, state: nextState };
  }

  private withSession(
    response: RecruiterAssistantResponseDto,
    sessionId: string,
    messageLocale: Locale,
  ): RecruiterAssistantResponseDto {
    return {
      ...response,
      sessionId,
      locale: response.locale ?? messageLocale,
    };
  }
}
