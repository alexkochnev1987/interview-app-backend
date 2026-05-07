import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionExpectedConceptDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  weight: number;

  @ApiProperty()
  description: string;
}

export class QuestionRedFlagDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  severity: 'low' | 'medium' | 'high';
}

export class QuestionResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  externalId?: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  focus?: string;

  @ApiProperty()
  outputLanguage: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  subcategory?: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ type: [String] })
  followUpQuestions: string[];

  @ApiProperty({ type: [QuestionExpectedConceptDto] })
  expectedConcepts: QuestionExpectedConceptDto[];

  @ApiProperty({ type: [QuestionRedFlagDto] })
  redFlags: QuestionRedFlagDto[];

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty()
  weight: number;

  @ApiPropertyOptional()
  sampleGoodAnswer?: string;

  @ApiProperty()
  minimumPassScore: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deleted: boolean;
}

export class QuestionDraftResponseDto {
  @ApiPropertyOptional()
  externalId?: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  focus?: string;

  @ApiProperty()
  outputLanguage: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  subcategory?: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ type: [String] })
  followUpQuestions: string[];

  @ApiProperty({ type: [QuestionExpectedConceptDto] })
  expectedConcepts: QuestionExpectedConceptDto[];

  @ApiProperty({ type: [QuestionRedFlagDto] })
  redFlags: QuestionRedFlagDto[];

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty()
  weight: number;

  @ApiPropertyOptional()
  sampleGoodAnswer?: string;

  @ApiProperty()
  minimumPassScore: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata: Record<string, unknown>;
}

export class DeleteQuestionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: true })
  deleted: true;
}

export class BulkDeleteBlockedItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty()
  reason: string;
}

export class BulkDeleteQuestionsResponseDto {
  @ApiProperty({ type: [String] })
  deleted: string[];

  @ApiProperty({ type: [BulkDeleteBlockedItemDto] })
  blocked: BulkDeleteBlockedItemDto[];
}

export class SimilarQuestionMatchDto {
  @ApiProperty({ type: QuestionResponseDto })
  question: QuestionResponseDto;

  @ApiProperty()
  score: number;

  @ApiProperty({ type: [String] })
  reasons: string[];
}

export class FindSimilarResponseDto {
  @ApiProperty({ type: [SimilarQuestionMatchDto] })
  matches: SimilarQuestionMatchDto[];
}
