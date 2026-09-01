import { Locale } from '../../locale/locale.constants';
import {
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantSuggestedQuestionDto,
} from './dto/recruiter-assistant.dto';
import { assistantMessage as msg } from './recruiter-assistant-i18n';

export function buildQuestionPlanResponse(input: {
  existingCount: number;
  missingCount: number;
  canCreateQuestions: boolean;
  canCreateInterviews: boolean;
  candidateName?: string;
  messageLocale: Locale;
}): string {
  const {
    existingCount,
    missingCount,
    canCreateQuestions,
    canCreateInterviews,
    candidateName,
    messageLocale,
  } = input;

  const creationNote =
    missingCount === 0
      ? msg(messageLocale, 'questionPlan.allMatched')
      : canCreateQuestions
        ? msg(messageLocale, 'questionPlan.foundMatches', {
            existingCount,
            missingCount,
          })
        : msg(messageLocale, 'questionPlan.noCreatePermission', {
            existingCount,
            missingCount,
          });

  const interviewNote =
    candidateName && canCreateInterviews
      ? msg(messageLocale, 'questionPlan.confirmWithInterview', {
          candidateName,
        })
      : candidateName
        ? msg(messageLocale, 'questionPlan.noInterviewPermission')
        : msg(messageLocale, 'questionPlan.confirmQuestionsOnly');

  return `${creationNote} ${interviewNote}`;
}

export function mergeCreatedQuestionSuggestions(
  questions: RecruiterAssistantCreatePendingActionDto['questions'],
  createdQuestions: RecruiterAssistantSuggestedQuestionDto[],
): RecruiterAssistantSuggestedQuestionDto[] {
  return questions.map((question) => {
    const created = createdQuestions.find((item) => item.key === question.key);
    return created ?? question;
  });
}
