import { Locale, DEFAULT_LOCALE } from '../../locale/locale.constants';
import { CreateQuestionDto } from '../../question/dto/create-question.dto';
import { QuestionExpectedConcept } from '../../question/interfaces/question.interface';
import { RecruiterAssistantSuggestedQuestionDto } from './dto/recruiter-assistant.dto';

export function toCreateQuestionDto(
  question: RecruiterAssistantSuggestedQuestionDto,
  position: string,
  locale: Locale,
): CreateQuestionDto {
  const primaryLocale = locale ?? DEFAULT_LOCALE;
  return {
    primaryLocale,
    translations: {
      [primaryLocale]: {
        questionText: question.questionText,
        followUpQuestions: question.followUpQuestions ?? [],
        expectedConcepts: toExpectedConcepts(question.expectedConcepts ?? []),
        redFlags: [
          {
            id: 'no_specific_example',
            label: 'No specific example',
            severity: 'medium',
          },
          {
            id: 'misses_tradeoffs',
            label: 'Misses trade-offs',
            severity: 'medium',
          },
        ],
        sampleGoodAnswer: question.sampleGoodAnswer ?? '',
      },
    },
    role: position,
    category: question.category,
    subcategory: question.subcategory,
    difficulty: question.difficulty ?? 'medium',
    weight: 1,
    minimumPassScore: 3,
    tags: question.tags ?? [],
    metadata: {
      source: 'recruiter-assistant',
    },
  };
}

function toExpectedConcepts(labels: string[]): QuestionExpectedConcept[] {
  const weight = labels.length > 0 ? 1 / labels.length : 1;
  return (labels.length > 0 ? labels : ['clear reasoning']).map((label) => ({
    id: slugify(label),
    label,
    weight,
    description: `Candidate should cover ${label}.`,
  }));
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'concept';
}
