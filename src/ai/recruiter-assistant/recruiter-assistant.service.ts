import { Injectable } from '@nestjs/common';

import { RecruiterAssistantConfigService } from '../../app-config/recruiter-assistant-config.service';
import { Locale } from '../../locale/locale.constants';
import {
  RecruiterAssistantChatDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import {
  canAccessChat,
  isCancellationMessage,
  isConfirmationMessage,
  isConversationResetMessage,
  OUT_OF_SCOPE_RESPONSE,
  recruiterAssistantDisabledResponse,
} from './recruiter-assistant.policy';
import { ActingUser } from './recruiter-assistant.types';
import { RecruiterConversationFlowService } from './recruiter-conversation-flow.service';
import { idleConversationState } from './recruiter-conversation-slots';
import { RecruiterConversationStore } from './recruiter-conversation.store';
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
    if (
      !(await this.recruiterAssistantConfig.isRecruiterAssistantEnabledForRole(
        user.role,
      ))
    ) {
      const globallyEnabled =
        await this.recruiterAssistantConfig.isRecruiterAssistantEnabled();
      return {
        status: 'refused',
        response: recruiterAssistantDisabledResponse(!globallyEnabled),
      };
    }

    if (!canAccessChat(user)) {
      return { status: 'refused', response: OUT_OF_SCOPE_RESPONSE };
    }

    const message = dto.message.trim();
    if (isConversationResetMessage(message)) {
      return this.newChat(user);
    }

    const intent = this.intentRouter.classify(message, user, locale);
    if (intent.kind === 'new_chat') {
      return this.newChat(user);
    }

    let sessionId = dto.sessionId;
    if (!sessionId || !this.conversationStore.get(user.id, sessionId)) {
      sessionId = this.conversationStore.issue(user.id);
    }

    const conversationState =
      this.conversationStore.get(user.id, sessionId) ?? idleConversationState();

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
              response:
                'That confirmation expired, was already used, or does not belong to your account.',
            },
            sessionId,
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
                response:
                  'That confirmation could not be applied. Please review the question list and try again.',
              },
              sessionId,
            );
          }
          confirmedAction = overridden;
        }

        return this.withSession(
          await this.pendingActionExecutor.execute(
            confirmedAction,
            user,
            locale,
          ),
          sessionId,
        );
      }

      if (isCancellationMessage(message)) {
        await this.pendingActionStore.revoke(user.id, dto.pendingActionId);
        return this.withSession(
          {
            status: 'answered',
            response: 'Cancelled. No changes were made.',
          },
          sessionId,
        );
      }
    }

    const activeFlowResponse = await this.conversationFlow.resumeActiveFlow({
      user,
      locale,
      sessionId,
      message,
      state: conversationState,
    });
    if (activeFlowResponse) {
      return this.withSession(activeFlowResponse, sessionId);
    }

    switch (intent.kind) {
      case 'list_interviews':
        return this.withSession(
          await this.tools.listInterviews(
            intent.filters,
            user,
            locale,
            intent.readyForReview,
          ),
          sessionId,
        );
      case 'list_unassigned':
        return this.withSession(
          await this.tools.listUnassigned(user, locale),
          sessionId,
        );
      case 'list_hrs':
        return this.withSession(
          await this.tools.listHrs(user, locale),
          sessionId,
        );
      case 'interview_status':
        return this.withSession(
          await this.tools.getInterviewStatus(
            intent.ref,
            user,
            locale,
            intent.ownInterviews,
            intent.scheduleInquiry,
          ),
          sessionId,
        );
      case 'review_state':
        return this.withSession(
          await this.tools.getReviewState(intent.ref, user, locale),
          sessionId,
        );
      case 'assign_hr':
        return this.withSession(
          await this.tools.prepareAssignHr(intent, user, locale, sessionId),
          sessionId,
        );
      case 'create_question':
        return this.withSession(
          await this.tools.prepareCreateQuestion(
            intent.questionName,
            user,
            locale,
            sessionId,
          ),
          sessionId,
        );
      case 'create_interview':
        return this.withSession(
          await this.tools.prepareCreateInterview(
            intent.candidateName,
            intent.position,
            user,
            locale,
            sessionId,
          ),
          sessionId,
        );
      case 'create_questions_interview':
        return this.withSession(
          await this.tools.prepareCreateQuestions(intent.parsed, user, locale),
          sessionId,
        );
      case 'switch_locale':
        return this.withSession(
          this.tools.switchLocale(
            intent.requestedLocale,
            intent.rawToken,
            locale,
          ),
          sessionId,
        );
      case 'count_questions':
        return this.withSession(
          await this.tools.countQuestions(intent.filters, user, locale),
          sessionId,
        );
      case 'list_assessments':
        return this.withSession(
          await this.tools.listAssessments(intent.filters, user, locale),
          sessionId,
        );
      case 'interview_activity_summary':
        return this.withSession(
          await this.tools.summarizeInterviewActivity(user, locale),
          sessionId,
        );
      case 'list_team':
        return this.withSession(
          { status: 'refused', response: 'Not implemented yet.' },
          sessionId,
        );
      case 'out_of_scope':
        return this.withSession(
          { status: 'refused', response: OUT_OF_SCOPE_RESPONSE },
          sessionId,
        );
    }
  }

  async newChat(user: ActingUser): Promise<RecruiterAssistantResponseDto> {
    if (
      !(await this.recruiterAssistantConfig.isRecruiterAssistantEnabledForRole(
        user.role,
      ))
    ) {
      const globallyEnabled =
        await this.recruiterAssistantConfig.isRecruiterAssistantEnabled();
      return {
        status: 'refused',
        response: recruiterAssistantDisabledResponse(!globallyEnabled),
      };
    }

    if (!canAccessChat(user)) {
      return { status: 'refused', response: OUT_OF_SCOPE_RESPONSE };
    }

    return this.resetConversation(user);
  }

  private async resetConversation(
    user: ActingUser,
  ): Promise<RecruiterAssistantResponseDto> {
    this.conversationStore.clearAllForUser(user.id);
    await this.pendingActionStore.revokeAllForUser(user.id);
    const sessionId = this.conversationStore.issue(user.id);
    return this.withSession(this.tools.startNewChat(), sessionId);
  }

  private withSession(
    response: RecruiterAssistantResponseDto,
    sessionId: string,
  ): RecruiterAssistantResponseDto {
    return { ...response, sessionId };
  }
}
