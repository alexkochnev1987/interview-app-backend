import { Interview } from './interfaces/interview.interface';
import { InterviewPresentation, presentInterview } from './present-interview';

export type InterviewQuestionPreview = {
  id: string;
  questionText: string;
  resolvedLocale: Interview['interviewLocale'];
};

export type InterviewListItemPresentation = Omit<InterviewPresentation, 'questions'> & {
  questionCount: number;
  questionsPreview: InterviewQuestionPreview[];
};

export function presentInterviewListItem(
  interview: Interview,
): InterviewListItemPresentation {
  const presented = presentInterview(interview);
  const { questions, ...rest } = presented;

  return {
    ...rest,
    questionCount: questions.length,
    questionsPreview: questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      resolvedLocale: question.resolvedLocale,
    })),
  };
}
