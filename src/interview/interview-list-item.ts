import type {
  Interview,
  InterviewDecision,
  InterviewListItem,
  InterviewStatus,
} from './interfaces/interview.interface';
import { getSubmittedAnswerCount } from './interview-completion-rules';

export interface InterviewListRow {
  id: string;
  candidate_name: string;
  candidate_email: string | null;
  position: string;
  status: InterviewStatus;
  created_at: Date;
  updated_at: Date;
  question_count: number;
  submitted_answer_count: number;
  overall_score: number | null;
  decision: string | null;
}

const INTERVIEW_DECISIONS = new Set<InterviewDecision>([
  'proceed',
  'review',
  'reject',
]);

function parseInterviewDecision(
  value: string | null,
): InterviewDecision | undefined {
  if (!value || !INTERVIEW_DECISIONS.has(value as InterviewDecision)) {
    return undefined;
  }
  return value as InterviewDecision;
}

export function fromInterviewListRow(row: InterviewListRow): InterviewListItem {
  return {
    id: row.id,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email ?? undefined,
    position: row.position,
    status: row.status,
    questionCount: Number(row.question_count),
    submittedAnswerCount: Number(row.submitted_answer_count),
    overallScore: row.overall_score ?? undefined,
    decision: parseInterviewDecision(row.decision),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

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
