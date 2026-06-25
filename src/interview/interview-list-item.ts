import type { Interview, InterviewListItem } from './interfaces/interview.interface';
import { getSubmittedAnswerCount } from './interview-completion-rules';

export function toInterviewListItem(interview: Interview): InterviewListItem {
  return {
    id: interview.id,
    candidateName: interview.candidateName,
    candidateEmail: interview.candidateEmail,
    position: interview.position,
    status: interview.status,
    questionCount: interview.questions.length,
    submittedAnswerCount: getSubmittedAnswerCount(interview),
    overallScore: interview.result?.overallScore,
    decision: interview.result?.decision,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
  };
}
