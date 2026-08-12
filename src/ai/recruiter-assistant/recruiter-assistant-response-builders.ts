import { SimilarQuestionMatch } from '../../question/interfaces/question.interface';
import {
  RecruiterAssistantCreatedQuestionDto,
  RecruiterAssistantRedirectDto,
  RecruiterAssistantSimilarQuestionDto,
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

export function buildSimilarQuestionMatchCard(input: {
  id: string;
  questionText: string;
  score: number;
}): RecruiterAssistantSimilarQuestionDto {
  return {
    id: input.id,
    questionText: input.questionText,
    score: input.score,
    href: `/questions/${input.id}`,
  };
}

export function buildSimilarQuestionMatchCards(
  matches: SimilarQuestionMatch[],
): RecruiterAssistantSimilarQuestionDto[] {
  return matches.map((match) =>
    buildSimilarQuestionMatchCard({
      id: match.question.id,
      questionText: match.question.questionText,
      score: match.score,
    }),
  );
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
