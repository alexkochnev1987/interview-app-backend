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

export class QuestionDeleteBlockingInterviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  candidateName: string;

  @ApiProperty({
    description: 'Staff app path to open the blocking interview.',
    example: '/interviews/550e8400-e29b-41d4-a716-446655440000',
  })
  href: string;
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

  @ApiProperty({
    description:
      'True when deletion is scheduled because the question is still used by active interviews.',
  })
  pendingDeletion: boolean;

  @ApiPropertyOptional({
    type: [QuestionDeleteBlockingInterviewDto],
    description:
      'Present when pendingDeletion is true — active interviews still using this question.',
  })
  blockingInterviews?: QuestionDeleteBlockingInterviewDto[];

  @ApiProperty({ description: 'Number of times this question has been used in an interview.' })
  usageCount: number;
}

export class PaginatedQuestionsResponseDto {
  @ApiProperty({ type: [QuestionResponseDto] })
  items: QuestionResponseDto[];

  @ApiProperty({ description: 'Total rows matching the filter, ignoring page/limit.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
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

  @ApiPropertyOptional({ example: true })
  deleted?: true;

  @ApiPropertyOptional({ example: true })
  scheduled?: true;

  @ApiPropertyOptional({ type: [QuestionDeleteBlockingInterviewDto] })
  blockingInterviews?: QuestionDeleteBlockingInterviewDto[];
}

export class BulkDeleteScheduledItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty()
  reason: string;

  @ApiProperty({ type: [QuestionDeleteBlockingInterviewDto] })
  blockingInterviews: QuestionDeleteBlockingInterviewDto[];
}

export class BulkDeleteQuestionsResponseDto {
  @ApiProperty({ type: [String] })
  deleted: string[];

  @ApiProperty({ type: [BulkDeleteScheduledItemDto] })
  scheduled: BulkDeleteScheduledItemDto[];
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

export class FacetCountDto {
  @ApiProperty()
  value: string;

  @ApiProperty({ description: 'Number of active questions with this value, given the rest of the current filters.' })
  count: number;
}

export class QuestionFacetsResponseDto {
  @ApiProperty({
    type: [FacetCountDto],
    description: 'Difficulty value + count, given all OTHER current filters (difficulty itself is not applied).',
  })
  difficulties: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Category value + count, given all OTHER current filters (category itself is not applied).',
  })
  categories: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Subcategory value + count, given all OTHER current filters (subcategory itself is not applied). Exposed as the "Type" facet in the picker.',
  })
  subcategories: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Role value + count, given all OTHER current filters (role itself is not applied).',
  })
  roles: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Tag value + count, given all OTHER current filters (tag overlap is not applied).',
  })
  tags: FacetCountDto[];
}
