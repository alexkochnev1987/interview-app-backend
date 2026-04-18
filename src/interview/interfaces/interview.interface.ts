import { QuestionCore } from '../../question/interfaces/question.interface';

export type InterviewQuestion = QuestionCore;

export interface CandidateQuestionView {
  text: string;
}

export interface Interview {
  id: string;
  candidateName: string;
  position: string;
  questions: InterviewQuestion[];
  answers: Answer[];
  status: 'pending' | 'in_progress' | 'processing' | 'completed' | 'failed';
  result?: InterviewResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface Answer {
  questionIndex: number;
  mediaKey: string;
  uploadedAt: Date;
}

export interface InterviewResult {
  overallScore: number;
  summary: string;
  categoryScores: Record<string, number>;
  completedAt: Date;
}
