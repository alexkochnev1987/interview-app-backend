import { Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { InterviewService } from '../../interview/interview.service';
import { Locale } from '../../locale/locale.constants';
import { QuestionService } from '../../question/question.service';
import {
  RecruiterAssistantPendingActionDto,
  RecruiterAssistantResponseDto,
  RecruiterAssistantSuggestedQuestionDto,
} from './dto/recruiter-assistant.dto';
import { canCreateInterviews, canCreateQuestions } from './recruiter-assistant.policy';
import { mergeCreatedQuestionSuggestions } from './recruiter-assistant-response';
import { ActingUser } from './recruiter-assistant.types';
import { toCreateQuestionDto } from './recruiter-question-create-dto.mapper';

@Injectable()
export class RecruiterPendingActionExecutorService {
  constructor(
    private readonly questionService: QuestionService,
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
  ) {}

  async execute(
    action: RecruiterAssistantPendingActionDto,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    const createdQuestions: RecruiterAssistantSuggestedQuestionDto[] = [];
    const finalQuestionIds: string[] = [];

    for (const question of action.questions) {
      if (question.existingQuestionId) {
        finalQuestionIds.push(question.existingQuestionId);
        continue;
      }

      if (!canCreateQuestions(user)) {
        return {
          status: 'refused',
          response:
            'I cannot create the missing questions because your user does not have questions:create permission.',
          suggestedQuestions: action.questions,
          pendingAction: action,
        };
      }

      const created = await this.questionService.createResolved(
        toCreateQuestionDto(
          question,
          action.position,
          action.interviewLocale ?? locale,
        ),
      );
      finalQuestionIds.push(created.id);
      createdQuestions.push({
        ...question,
        existingQuestionId: created.id,
        existingQuestionText: created.questionText,
        needsCreation: false,
      });
    }

    if (action.type === 'create_questions' || !action.candidateName) {
      return {
        status: 'executed',
        response:
          createdQuestions.length === 0
            ? 'No new questions were needed. The suggested set is ready.'
            : `Created ${createdQuestions.length} missing questions. Send me the candidate name when you want to create the interview.`,
        suggestedQuestions: mergeCreatedQuestionSuggestions(
          action.questions,
          createdQuestions,
        ),
      };
    }

    if (!canCreateInterviews(user)) {
      return {
        status: 'refused',
        response:
          'The questions are ready, but I cannot create the interview because your user does not have interviews:create permission.',
      };
    }

    const created = await this.interviewService.create(
      {
        candidateName: action.candidateName,
        candidateEmail: action.candidateEmail,
        position: action.position,
        interviewLocale: action.interviewLocale ?? locale,
        questionIds: finalQuestionIds,
      },
      { createdById: user.id, demo: user.demo },
    );
    const token = this.authService.generateCandidateToken(created.interview.id);
    const candidateLink = `/take/${created.interview.id}?token=${token}`;

    return {
      status: 'executed',
      response: `Interview created for ${action.candidateName}. Created ${createdQuestions.length} missing questions and attached ${finalQuestionIds.length} questions.`,
      createdInterview: {
        id: created.interview.id,
        candidateLink,
      },
    };
  }
}
