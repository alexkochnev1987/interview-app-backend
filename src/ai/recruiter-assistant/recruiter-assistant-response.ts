import {
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantSuggestedQuestionDto,
} from './dto/recruiter-assistant.dto';

export function buildQuestionPlanResponse(input: {
  existingCount: number;
  missingCount: number;
  canCreateQuestions: boolean;
  canCreateInterviews: boolean;
  candidateName?: string;
}): string {
  const {
    existingCount,
    missingCount,
    canCreateQuestions,
    canCreateInterviews,
    candidateName,
  } = input;

  const creationNote =
    missingCount === 0
      ? 'All suggested questions already have close matches in the question bank.'
      : canCreateQuestions
        ? `I found ${existingCount} close matches and ${missingCount} questions would need to be created.`
        : `I found ${existingCount} close matches and ${missingCount} gaps, but your user cannot create questions.`;

  const interviewNote =
    candidateName && canCreateInterviews
      ? `Confirm and I will create the missing questions, then create the interview for ${candidateName}.`
      : candidateName
        ? 'Your user cannot create interviews, so I can only prepare the question set.'
        : 'Confirm and I will create the missing questions. Send the candidate name when you want me to create the interview.';

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
