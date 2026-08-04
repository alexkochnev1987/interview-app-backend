import { Injectable } from '@nestjs/common';
import { Locale } from '../../locale/locale.constants';
import {
  RecruiterAssistantChatDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import {
  canAccessChat,
  isCancellationMessage,
  isConfirmationMessage,
  OUT_OF_SCOPE_RESPONSE,
  RECRUITER_ASSISTANT_DISABLED_RESPONSE,
} from './recruiter-assistant.policy';
import { ActingUser } from './recruiter-assistant.types';
import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterPendingActionExecutorService } from './recruiter-pending-action-executor.service';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { isRecruiterAssistantEnabled } from './recruiter-assistant-env';

@Injectable()
export class RecruiterAssistantService {
  constructor(
    private readonly intentRouter: RecruiterAssistantIntentService,
    private readonly tools: RecruiterAssistantToolsService,
    private readonly pendingActionExecutor: RecruiterPendingActionExecutorService,
    private readonly pendingActionStore: RecruiterPendingActionStore,
    private readonly conversationStore: RecruiterConversationStore,
  ) {}

  async chat(
    dto: RecruiterAssistantChatDto,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!isRecruiterAssistantEnabled()) {
      return { status: 'refused', response: RECRUITER_ASSISTANT_DISABLED_RESPONSE };
    }

    if (!canAccessChat(user)) {
      return { status: 'refused', response: OUT_OF_SCOPE_RESPONSE };
    }

    let sessionId = dto.sessionId;
    if (!sessionId || !this.conversationStore.get(user.id, sessionId)) {
      sessionId = this.conversationStore.issue(user.id);
    }

    const message = dto.message.trim();

    if (dto.pendingActionId) {
      if (isConfirmationMessage(message)) {
        const action = this.pendingActionStore.consume(
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

        return this.withSession(
          await this.pendingActionExecutor.execute(action, user, locale),
          sessionId,
        );
      }

      if (isCancellationMessage(message)) {
        this.pendingActionStore.revoke(user.id, dto.pendingActionId);
        return this.withSession(
          {
            status: 'answered',
            response: 'Cancelled. No changes were made.',
          },
          sessionId,
        );
      }
    }

    const intent = this.intentRouter.classify(message, user, locale);

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
          await this.tools.prepareAssignHr(intent, user, locale),
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
      case 'out_of_scope':
        return this.withSession(
          { status: 'refused', response: OUT_OF_SCOPE_RESPONSE },
          sessionId,
        );
    }
  }

  private withSession(
    response: RecruiterAssistantResponseDto,
    sessionId: string,
  ): RecruiterAssistantResponseDto {
    return { ...response, sessionId };
  }
}
