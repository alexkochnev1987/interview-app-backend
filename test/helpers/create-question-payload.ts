import { CreateQuestionDto } from '../../src/question/dto/create-question.dto';
import { QuestionDifficulty } from '../../src/question/interfaces/question.interface';

export function buildCreateQuestionPayload(
  questionText: string,
  options: {
    difficulty?: QuestionDifficulty;
    weight?: number;
    tags?: string[];
  } = {},
): CreateQuestionDto {
  return {
    primaryLocale: 'en',
    translations: {
      en: {
        questionText,
        followUpQuestions: ['Can you walk through an example?'],
        expectedConcepts: [
          {
            id: 'core_concept',
            label: 'Core concept',
            weight: 1,
            description: 'Candidate explains the main idea clearly.',
          },
        ],
        redFlags: [
          {
            id: 'hand_wavy',
            label: 'Hand-wavy answer',
            severity: 'medium',
          },
        ],
        sampleGoodAnswer: 'A concrete, structured answer with trade-offs.',
      },
    },
    difficulty: options.difficulty ?? 'medium',
    weight: options.weight ?? 1,
    ...(options.tags ? { tags: options.tags } : {}),
  };
}
