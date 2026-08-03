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
} from './recruiter-assistant.policy';
import { ActingUser } from './recruiter-assistant.types';
import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterPendingActionExecutorService } from './recruiter-pending-action-executor.service';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';

@Injectable()
export class RecruiterAssistantService {
  constructor(
    private readonly intentRouter: RecruiterAssistantIntentService,
    private readonly tools: RecruiterAssistantToolsService,
    private readonly pendingActionExecutor: RecruiterPendingActionExecutorService,
    private readonly pendingActionStore: RecruiterPendingActionStore,
  ) {}

  async chat(
    dto: RecruiterAssistantChatDto,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canAccessChat(user)) {
      return { status: 'refused', response: OUT_OF_SCOPE_RESPONSE };
    }

    const message = dto.message.trim();

    if (dto.pendingActionId) {
      if (isConfirmationMessage(message)) {
        const action = this.pendingActionStore.consume(
          user.id,
          dto.pendingActionId,
        );
        if (!action) {
          return {
            status: 'refused',
            response:
              'That confirmation expired, was already used, or does not belong to your account.',
          };
        }

        return this.pendingActionExecutor.execute(action, user, locale);
      }

      if (isCancellationMessage(message)) {
        this.pendingActionStore.revoke(user.id, dto.pendingActionId);
        return {
          status: 'answered',
          response: 'Cancelled. No changes were made.',
        };
      }
    }

    const intent = this.intentRouter.classify(message, user, locale);

    switch (intent.kind) {
      case 'list_interviews':
        return this.tools.listInterviews(
          intent.filters,
          user,
          locale,
          intent.readyForReview,
        );
      case 'list_unassigned':
        return this.tools.listUnassigned(user, locale);
      case 'interview_status':
        return this.tools.getInterviewStatus(
          intent.ref,
          user,
          locale,
          intent.ownInterviews,
          intent.scheduleInquiry,
        );
      case 'review_state':
        return this.tools.getReviewState(intent.ref, user, locale);
      case 'assign_hr':
        return this.tools.prepareAssignHr(intent, user, locale);
      case 'create_questions_interview':
        return this.tools.prepareCreateQuestions(intent.parsed, user, locale);
      case 'out_of_scope':
        return { status: 'refused', response: OUT_OF_SCOPE_RESPONSE };
    }
  }
}
