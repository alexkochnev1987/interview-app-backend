import { QuestionCore } from '../../question/interfaces/question.interface';

/** Keep in sync with interviews.status CHECK in src/database/migrations.ts */
export const INTERVIEW_STATUSES = [
  'pending',
  'in_progress',
  'processing',
  'completed',
  'failed',
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const ACTIVE_INTERVIEW_STATUSES = [
  'pending',
  'in_progress',
  'processing',
] as const satisfies readonly InterviewStatus[];

export type ActiveInterviewStatus = (typeof ACTIVE_INTERVIEW_STATUSES)[number];

export type InterviewQuestion = QuestionCore;
export type InterviewBehaviorRisk = 'low' | 'medium' | 'high';
export type InterviewDecision = 'proceed' | 'review' | 'reject';
export type AnswerDecisionHint = 'pass' | 'review' | 'fail';
export type AnswerStatus = 'recording' | 'submitted';
export type AnswerValidationStatus =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';
export type InterviewWorkflowStatus =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';
export type InterviewWorkflowStage =
  | 'validate_answers'
  | 'transcribe_audio'
  | 'analyze_answers'
  | 'aggregate_result'
  | 'store_result';

export interface CandidateQuestionView {
  text: string;
}

export interface Interview {
  id: string;
  candidateName: string;
  candidateEmail?: string;
  position: string;
  questions: InterviewQuestion[];
  answers: Answer[];
  status: InterviewStatus;
  result?: InterviewResult;
  workflow?: InterviewWorkflow;
  createdById?: string;
  demo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaArtifact {
  mediaKey: string;
  contentType: string;
  fileSizeBytes?: number;
  uploadedAt: Date;
}

export interface AnswerBehaviorSignals {
  tabHiddenCount: number;
  windowBlurCount: number;
  pasteCount: number;
  keydownCount: number;
  copyCount: number;
  resizeCount: number;
}

export interface AnswerBehaviorEvent {
  eventType:
    | 'tab_hidden'
    | 'window_blur'
    | 'paste'
    | 'keydown'
    | 'resize'
    | 'copy';
  occurredAt: Date;
  versionNumber: number;
}

export interface AnswerTranscript {
  text?: string;
  language?: string;
  provider?: string;
  generatedAt?: Date;
  isFinal?: boolean;
}

export interface AnswerEvaluation {
  overallScore?: number;
  categoryScores?: Record<string, number>;
  coveredConceptIds?: string[];
  missedConceptIds?: string[];
  redFlagIds?: string[];
  behaviorRisk?: InterviewBehaviorRisk;
  summary?: string;
  decisionHint?: AnswerDecisionHint;
  evaluatedAt?: Date;
}

export interface AnswerValidation {
  status: AnswerValidationStatus;
  executionArn?: string;
  sourceVersionNumber?: number;
  runId?: string;
  requestedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface AnswerVersion {
  versionNumber: number;
  mediaKey: string;
  screenMediaKey?: string;
  uploadedAt: Date;
  durationSeconds?: number;
  startedAt?: Date;
  submittedAt?: Date;
  camera?: MediaArtifact;
  screen?: MediaArtifact;
  behaviorSignals?: AnswerBehaviorSignals;
  behaviorEvents?: AnswerBehaviorEvent[];
}

export interface Answer {
  questionIndex: number;
  questionId: string;
  status: AnswerStatus;
  mediaKey: string;
  screenMediaKey?: string;
  uploadedAt: Date;
  durationSeconds?: number;
  retakeCount?: number;
  startedAt?: Date;
  submittedAt?: Date;
  camera?: MediaArtifact;
  screen?: MediaArtifact;
  behaviorSignals?: AnswerBehaviorSignals;
  selectedVersionNumber?: number;
  versions?: AnswerVersion[];
  behaviorEvents?: AnswerBehaviorEvent[];
  transcript?: AnswerTranscript;
  evaluation?: AnswerEvaluation;
  validation?: AnswerValidation;
}

export interface InterviewQuestionResult {
  questionIndex: number;
  questionId: string;
  score?: number;
  categoryScores?: Record<string, number>;
  summary?: string;
  decisionHint?: AnswerDecisionHint;
}

export interface InterviewBehaviorSummary {
  riskLevel?: InterviewBehaviorRisk;
  notes: string[];
}

export interface InterviewResult {
  overallScore: number;
  summary: string;
  categoryScores: Record<string, number>;
  rubricVersion?: string;
  decision?: InterviewDecision;
  trustScore?: number;
  trustFlags?: string[];
  behaviorSummary?: InterviewBehaviorSummary;
  questionResults?: InterviewQuestionResult[];
  completedAt: Date;
}

export interface InterviewWorkflow {
  status: InterviewWorkflowStatus;
  currentStage?: InterviewWorkflowStage;
  executionId?: string;
  startedAt?: Date;
  completedAt?: Date;
  lastUpdatedAt: Date;
  errorMessage?: string;
}
