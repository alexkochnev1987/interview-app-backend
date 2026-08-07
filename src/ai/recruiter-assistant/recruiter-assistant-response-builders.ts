import {
  RecruiterAssistantCreatedQuestionDto,
  RecruiterAssistantRedirectDto,
} from './dto/recruiter-assistant.dto';

export function buildCreatedQuestionCard(input: {
  id: string;
  questionText: string;
}): RecruiterAssistantCreatedQuestionDto {
  return {
    id: input.id,
    questionText: input.questionText,
    href: `/questions/${input.id}`,
  };
}

export function buildInterviewRedirect(input: {
  candidateName?: string;
  position?: string;
}): RecruiterAssistantRedirectDto {
  const query: Record<string, string> = {};
  if (input.candidateName) {
    query.candidateName = input.candidateName;
  }
  if (input.position) {
    query.position = input.position;
  }
  return {
    path: '/interviews/new',
    query: Object.keys(query).length > 0 ? query : undefined,
  };
}

export function buildInterviewCardHref(interviewId: string): string {
  return `/interviews/${interviewId}`;
}
