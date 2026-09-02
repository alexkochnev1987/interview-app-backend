import { Injectable } from '@nestjs/common';

import { Locale } from '../../locale/locale.constants';
import { RecruiterAssistantResponseDto } from './dto/recruiter-assistant.dto';
import { assistantMessage as msg } from './recruiter-assistant-i18n';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import {
  isCancellationMessage,
  isSimilarQuestionOverrideCancellation,
  isSimilarQuestionOverrideConfirmation,
} from './recruiter-assistant.policy';
import { ActingUser } from './recruiter-assistant.types';
import {
  captureAwaitingSlot,
  idleConversationState,
} from './recruiter-conversation-slots';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterConversationState } from './recruiter-conversation.types';

export interface ActiveFlowContext {
  user: ActingUser;
  locale: Locale;
  messageLocale: Locale;
  sessionId: string;
  message: string;
  state: RecruiterConversationState;
}

@Injectable()
export class RecruiterConversationFlowService {
  constructor(
    private readonly tools: RecruiterAssistantToolsService,
    private readonly conversationStore: RecruiterConversationStore,
  ) {}

  async resumeActiveFlow(
    ctx: ActiveFlowContext,
  ): Promise<RecruiterAssistantResponseDto | null> {
    if (ctx.state.flow === 'idle') {
      return null;
    }

    if (ctx.state.awaitingInput === 'confirmAddDespiteSimilar') {
      if (isSimilarQuestionOverrideCancellation(ctx.message)) {
        this.conversationStore.update(
          ctx.user.id,
          ctx.sessionId,
          this.idleState(ctx),
        );
        return {
          status: 'answered',
          response: msg(ctx.messageLocale, 'cancelled'),
        };
      }

      if (isSimilarQuestionOverrideConfirmation(ctx.message)) {
        const state = { ...ctx.state, awaitingInput: undefined };
        this.conversationStore.update(ctx.user.id, ctx.sessionId, state);
        return this.tools.continueCreateQuestionDespiteSimilar(
          state,
          ctx.user,
          ctx.locale,
          ctx.messageLocale,
          ctx.sessionId,
        );
      }

      return this.tools.repromptSimilarQuestionConfirmation(
        ctx.state,
        ctx.user,
        ctx.locale,
        ctx.messageLocale,
        ctx.sessionId,
      );
    }

    if (ctx.state.awaitingInput === 'confirmRegisteredCandidate') {
      return this.tools.continueCreateInterviewFlow(
        ctx.state,
        ctx.user,
        ctx.locale,
        ctx.messageLocale,
        ctx.sessionId,
        ctx.message,
      );
    }

    if (isCancellationMessage(ctx.message)) {
      this.conversationStore.update(
        ctx.user.id,
        ctx.sessionId,
        this.idleState(ctx),
      );
      return {
        status: 'answered',
        response: msg(ctx.messageLocale, 'cancelled'),
      };
    }

    const state = ctx.state.awaitingInput
      ? captureAwaitingSlot(ctx.state, ctx.message)
      : ctx.state;
    this.conversationStore.update(ctx.user.id, ctx.sessionId, {
      ...state,
      messageLocale: ctx.messageLocale,
    });

    switch (state.flow) {
      case 'assign_hr':
        return this.tools.continueAssignHrFlow(
          state,
          ctx.user,
          ctx.locale,
          ctx.messageLocale,
          ctx.sessionId,
        );
      case 'create_question':
        return this.tools.continueCreateQuestionFlow(
          state,
          ctx.user,
          ctx.locale,
          ctx.messageLocale,
          ctx.sessionId,
        );
      case 'create_interview':
        return this.tools.continueCreateInterviewFlow(
          state,
          ctx.user,
          ctx.locale,
          ctx.messageLocale,
          ctx.sessionId,
          ctx.message,
        );
      default:
        return null;
    }
  }

  private idleState(ctx: ActiveFlowContext): RecruiterConversationState {
    return {
      ...idleConversationState(),
      messageLocale: ctx.messageLocale,
    };
  }
}
