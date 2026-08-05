import { Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { InterviewService } from '../../interview/interview.service';
import { Locale } from '../../locale/locale.constants';
import { QuestionService } from '../../question/question.service';
import {
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantPendingActionDto,
  RecruiterAssistantResponseDto,
  RecruiterAssistantSuggestedQuestionDto,
} from './dto/recruiter-assistant.dto';
import {
  canAssignHr,
  canCreateInterviews,
  canCreateQuestions,
} from './recruiter-assistant.policy';
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
    if (action.type === 'assign_hr') {
      return this.executeAssignHr(action, user);
    }

    return this.executeCreate(action, user, locale);
  }

  private async executeAssignHr(
    action: RecruiterAssistantAssignHrPendingActionDto,
    user: ActingUser,
  ): Promise<RecruiterAssistantResponseDto> {
    if (!canAssignHr(user)) {
      return {
        status: 'refused',
        response: 'Only admins can assign HR reviewers.',
        escalateTo: 'admin',
      };
    }

    try {
      await this.interviewService.update(
        action.interviewId,
        { assignedHrId: action.assignedHrId },
        { id: user.id, role: user.role, demo: user.demo },
      );
    } catch {
      return {
        status: 'refused',
        response:
          'I could not assign that HR reviewer. Check the interview and reviewer ids and try again.',
      };
    }

    return {
      status: 'executed',
      response: `Assigned ${action.interviewLabel} to ${action.assignedHrName}.`,
    };
  }

  private async executeCreate(
    action: RecruiterAssistantCreatePendingActionDto,
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    const interviewLocale = action.interviewLocale ?? locale;
    const createdQuestions: RecruiterAssistantSuggestedQuestionDto[] = [];
    const createdQuestionIds: string[] = [];
    const finalQuestionIds: string[] = [];

    try {
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
          };
        }

        const created = await this.questionService.createResolved(
          toCreateQuestionDto(question, action.position, interviewLocale),
        );
        createdQuestionIds.push(created.id);
        finalQuestionIds.push(created.id);
        createdQuestions.push({
          ...question,
          existingQuestionId: created.id,
          existingQuestionText: created.questionText,
          needsCreation: false,
        });
      }
    } catch {
      await this.rollbackCreatedQuestions(createdQuestionIds, interviewLocale);

      return {
        status: 'refused',
        response:
          createdQuestionIds.length > 0
            ? 'Question creation failed partway through. Any new questions from this attempt were rolled back; no interview was created.'
            : 'Something went wrong while creating questions. No questions or interview were created; please start again.',
        suggestedQuestions: action.questions,
      };
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
      await this.rollbackCreatedQuestions(createdQuestionIds, interviewLocale);

      return {
        status: 'refused',
        response:
          createdQuestionIds.length > 0
            ? 'I cannot create the interview because your user does not have interviews:create permission. Any new questions from this attempt were rolled back.'
            : 'I cannot create the interview because your user does not have interviews:create permission.',
        suggestedQuestions: action.questions,
      };
    }

    try {
      const created = await this.interviewService.create(
        {
          candidateName: action.candidateName,
          candidateEmail: action.candidateEmail,
          position: action.position,
          interviewLocale,
          questionIds: finalQuestionIds,
        },
        {
          createdById: user.id,
          demo: user.demo,
          actor: { id: user.id, role: user.role, demo: user.demo },
        },
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
    } catch {
      await this.rollbackCreatedQuestions(createdQuestionIds, interviewLocale);

      return {
        status: 'refused',
        response:
          'Interview creation failed. Any new questions from this attempt were rolled back; please start again.',
        suggestedQuestions: action.questions,
      };
    }
  }

  private async rollbackCreatedQuestions(
    questionIds: string[],
    locale: Locale,
  ): Promise<void> {
    if (questionIds.length === 0) {
      return;
    }

    try {
      await this.questionService.softDeleteMany(questionIds, locale);
    } catch {
      // Best-effort rollback so a failed confirmation does not leave orphan questions.
    }
  }
}
