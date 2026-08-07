import { Injectable } from '@nestjs/common';
import { Locale } from '../../locale/locale.constants';
import { RecruiterAssistantResponseDto } from './dto/recruiter-assistant.dto';
import { isCancellationMessage } from './recruiter-assistant.policy';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { ActingUser } from './recruiter-assistant.types';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterConversationState } from './recruiter-conversation.types';
import {
  captureAwaitingSlot,
  idleConversationState,
} from './recruiter-conversation-slots';

export interface ActiveFlowContext {
  user: ActingUser;
  locale: Locale;
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

    if (isCancellationMessage(ctx.message)) {
      this.conversationStore.update(
        ctx.user.id,
        ctx.sessionId,
        idleConversationState(),
      );
      return {
        status: 'answered',
        response: 'Cancelled. No changes were made.',
      };
    }

    const state = ctx.state.awaitingInput
      ? captureAwaitingSlot(ctx.state, ctx.message)
      : ctx.state;
    this.conversationStore.update(ctx.user.id, ctx.sessionId, state);

    switch (state.flow) {
      case 'assign_hr':
        return this.tools.continueAssignHrFlow(
          state,
          ctx.user,
          ctx.locale,
          ctx.sessionId,
        );
      case 'create_question':
        return this.tools.continueCreateQuestionFlow(
          state,
          ctx.user,
          ctx.locale,
          ctx.sessionId,
        );
      case 'create_interview':
        return this.tools.continueCreateInterviewFlow(
          state,
          ctx.user,
          ctx.locale,
          ctx.sessionId,
        );
      default:
        return null;
    }
  }
}
