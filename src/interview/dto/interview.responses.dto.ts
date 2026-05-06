import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionResponseDto } from '../../question/dto/question.responses.dto';

export class CandidateLinkResponseDto {
  @ApiProperty()
  candidateLink: string;
}

export class StartAnswerValidationResultDto {
  @ApiProperty({ enum: ['idle', 'queued', 'processing', 'completed', 'failed'] })
  status: string;

  @ApiProperty()
  questionIndex: number;

  @ApiProperty()
  sourceVersionNumber: number;

  @ApiProperty()
  reused: boolean;
}

export class StartAllAnswerValidationsResponseDto {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty()
  interviewId: string;

  @ApiProperty()
  requestedCount: number;

  @ApiProperty()
  queuedCount: number;

  @ApiProperty()
  reusedCount: number;

  @ApiProperty()
  skippedCount: number;

  @ApiProperty({ type: [StartAnswerValidationResultDto] })
  answers: StartAnswerValidationResultDto[];
}

export class MediaArtifactDto {
  @ApiProperty()
  mediaKey: string;

  @ApiProperty()
  contentType: string;

  @ApiPropertyOptional()
  fileSizeBytes?: number;

  @ApiProperty()
  uploadedAt: Date;
}

export class AnswerBehaviorSignalsDto {
  @ApiProperty()
  tabHiddenCount: number;

  @ApiProperty()
  windowBlurCount: number;

  @ApiProperty()
  pasteCount: number;

  @ApiProperty()
  keydownCount: number;

  @ApiProperty()
  resizeCount: number;
}

export class AnswerBehaviorEventDto {
  @ApiProperty({
    enum: ['tab_hidden', 'window_blur', 'paste', 'keydown', 'resize'],
  })
  eventType: string;

  @ApiProperty()
  occurredAt: Date;

  @ApiProperty()
  versionNumber: number;
}

export class AnswerEvaluationDto {
  @ApiPropertyOptional()
  overallScore?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'number' } })
  categoryScores?: Record<string, number>;

  @ApiPropertyOptional({ type: [String] })
  coveredConceptIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  missedConceptIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  redFlagIds?: string[];

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  behaviorRisk?: string;

  @ApiPropertyOptional()
  summary?: string;

  @ApiPropertyOptional({ enum: ['pass', 'review', 'fail'] })
  decisionHint?: string;

  @ApiPropertyOptional()
  evaluatedAt?: Date;
}

export class AnswerValidationDto {
  @ApiProperty({ enum: ['idle', 'queued', 'processing', 'completed', 'failed'] })
  status: string;

  @ApiPropertyOptional()
  executionArn?: string;

  @ApiPropertyOptional()
  sourceVersionNumber?: number;

  @ApiPropertyOptional()
  requestedAt?: Date;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  errorMessage?: string;
}

export class AnswerTranscriptDto {
  @ApiPropertyOptional()
  text?: string;

  @ApiPropertyOptional()
  language?: string;

  @ApiPropertyOptional()
  provider?: string;

  @ApiPropertyOptional()
  generatedAt?: Date;

  @ApiPropertyOptional()
  isFinal?: boolean;
}

export class AnswerVersionDto {
  @ApiProperty()
  versionNumber: number;

  @ApiProperty()
  mediaKey: string;

  @ApiPropertyOptional()
  screenMediaKey?: string;

  @ApiProperty()
  uploadedAt: Date;

  @ApiPropertyOptional()
  durationSeconds?: number;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  submittedAt?: Date;

  @ApiPropertyOptional({ type: MediaArtifactDto })
  camera?: MediaArtifactDto;

  @ApiPropertyOptional({ type: MediaArtifactDto })
  screen?: MediaArtifactDto;

  @ApiPropertyOptional({ type: AnswerBehaviorSignalsDto })
  behaviorSignals?: AnswerBehaviorSignalsDto;

  @ApiPropertyOptional({ type: [AnswerBehaviorEventDto] })
  behaviorEvents?: AnswerBehaviorEventDto[];
}

export class AnswerDto {
  @ApiProperty()
  questionIndex: number;

  @ApiProperty()
  questionId: string;

  @ApiProperty({ enum: ['recording', 'submitted'] })
  status: string;

  @ApiProperty()
  mediaKey: string;

  @ApiPropertyOptional()
  screenMediaKey?: string;

  @ApiProperty()
  uploadedAt: Date;

  @ApiPropertyOptional()
  durationSeconds?: number;

  @ApiPropertyOptional()
  retakeCount?: number;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  submittedAt?: Date;

  @ApiPropertyOptional({ type: MediaArtifactDto })
  camera?: MediaArtifactDto;

  @ApiPropertyOptional({ type: MediaArtifactDto })
  screen?: MediaArtifactDto;

  @ApiPropertyOptional({ type: AnswerBehaviorSignalsDto })
  behaviorSignals?: AnswerBehaviorSignalsDto;

  @ApiPropertyOptional()
  selectedVersionNumber?: number;

  @ApiPropertyOptional({ type: AnswerTranscriptDto })
  transcript?: AnswerTranscriptDto;

  @ApiPropertyOptional({ type: AnswerEvaluationDto })
  evaluation?: AnswerEvaluationDto;

  @ApiPropertyOptional({ type: AnswerValidationDto })
  validation?: AnswerValidationDto;

  @ApiPropertyOptional({ type: [AnswerVersionDto] })
  versions?: AnswerVersionDto[];

  @ApiPropertyOptional({ type: [AnswerBehaviorEventDto] })
  behaviorEvents?: AnswerBehaviorEventDto[];
}

export class InterviewBehaviorSummaryDto {
  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  riskLevel?: string;

  @ApiProperty({ type: [String] })
  notes: string[];
}

export class InterviewWorkflowDto {
  @ApiProperty({ enum: ['idle', 'queued', 'processing', 'completed', 'failed'] })
  status: string;

  @ApiPropertyOptional({
    enum: [
      'validate_answers',
      'transcribe_audio',
      'analyze_answers',
      'aggregate_result',
      'store_result',
    ],
  })
  currentStage?: string;

  @ApiPropertyOptional()
  executionId?: string;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiProperty()
  lastUpdatedAt: Date;

  @ApiPropertyOptional()
  errorMessage?: string;
}

export class InterviewQuestionResultDto {
  @ApiProperty()
  questionIndex: number;

  @ApiProperty()
  questionId: string;

  @ApiPropertyOptional()
  score?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'number' } })
  categoryScores?: Record<string, number>;

  @ApiPropertyOptional()
  summary?: string;

  @ApiPropertyOptional({ enum: ['pass', 'review', 'fail'] })
  decisionHint?: string;
}

export class InterviewResultResponseDto {
  @ApiProperty()
  overallScore: number;

  @ApiProperty()
  summary: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  categoryScores: Record<string, number>;

  @ApiPropertyOptional()
  rubricVersion?: string;

  @ApiPropertyOptional({ enum: ['proceed', 'review', 'reject'] })
  decision?: string;

  @ApiPropertyOptional()
  trustScore?: number;

  @ApiPropertyOptional({ type: [String] })
  trustFlags?: string[];

  @ApiPropertyOptional({ type: InterviewBehaviorSummaryDto })
  behaviorSummary?: InterviewBehaviorSummaryDto;

  @ApiPropertyOptional({ type: [InterviewQuestionResultDto] })
  questionResults?: InterviewQuestionResultDto[];

  @ApiProperty()
  completedAt: Date;
}

export class InterviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  candidateName: string;

  @ApiPropertyOptional()
  candidateEmail?: string;

  @ApiProperty()
  position: string;

  @ApiProperty({ type: [QuestionResponseDto] })
  questions: QuestionResponseDto[];

  @ApiProperty({ type: [AnswerDto] })
  answers: AnswerDto[];

  @ApiProperty({ enum: ['pending', 'in_progress', 'processing', 'completed', 'failed'] })
  status: string;

  @ApiPropertyOptional({ type: InterviewResultResponseDto })
  result?: InterviewResultResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: InterviewWorkflowDto })
  workflow?: InterviewWorkflowDto;
}

export class InterviewWithCandidateLinkResponseDto extends InterviewResponseDto {
  @ApiProperty()
  candidateLink: string;
}
