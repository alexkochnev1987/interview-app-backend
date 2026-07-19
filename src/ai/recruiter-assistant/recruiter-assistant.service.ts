import { Injectable } from '@nestjs/common';
import { Locale } from '../../locale/locale.constants';
import {
  RecruiterAssistantChatDto,
  RecruiterAssistantPendingActionDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import {
  canCreateInterviews,
  canCreateQuestions,
  isConfirmationMessage,
  isRecruiterAssistantScope,
  OUT_OF_SCOPE_RESPONSE,
} from './recruiter-assistant.policy';
import { parseRecruiterRequest } from './recruiter-assistant-request-parser';
import { buildQuestionPlanResponse } from './recruiter-assistant-response';
import { ActingUser } from './recruiter-assistant.types';
import { RecruiterPendingActionExecutorService } from './recruiter-pending-action-executor.service';
import { buildQuestionSuggestions } from './recruiter-question-plan';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

@Injectable()
export class RecruiterAssistantService {
  constructor(
    private readonly questionMatcher: RecruiterQuestionMatcherService,
    private readonly pendingActionExecutor: RecruiterPendingActionExecutorService,
  ) {}

  async chat(
    dto: RecruiterAssistantChatDto,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    const message = dto.message.trim();

    if (dto.pendingAction && isConfirmationMessage(message)) {
      return this.pendingActionExecutor.execute(dto.pendingAction, user, locale);
    }

    if (!isRecruiterAssistantScope(message)) {
      return {
        status: 'refused',
        response: OUT_OF_SCOPE_RESPONSE,
      };
    }

    const parsed = parseRecruiterRequest(message, locale);
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
    const pendingAction: RecruiterAssistantPendingActionDto = {
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
}
