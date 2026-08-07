import { Locale } from '../../locale/locale.constants';
import { CreateQuestionDto } from '../../question/dto/create-question.dto';
import { QuestionDraftGenerate } from '../question-draft-content';

export function mapDraftGenerateToCreateQuestionDto(
  draft: QuestionDraftGenerate,
  locale: Locale,
): CreateQuestionDto {
  return {
    primaryLocale: locale,
    translations: {
      [locale]: {
        questionText: draft.questionText,
        followUpQuestions: draft.followUpQuestions,
        expectedConcepts: draft.expectedConcepts,
        redFlags: draft.redFlags,
        sampleGoodAnswer: draft.sampleGoodAnswer,
      },
    },
    externalId: draft.externalId,
    role: draft.role,
    focus: draft.focus,
    category: draft.category,
    subcategory: draft.subcategory,
    difficulty: draft.difficulty,
    weight: draft.weight,
    minimumPassScore: draft.minimumPassScore,
    tags: draft.tags,
    metadata: { source: 'recruiter-assistant' },
  };
}

export function isQuestionDraftGenerate(
  draft: QuestionDraftGenerate | { primaryLocale: Locale },
): draft is QuestionDraftGenerate {
  return 'difficulty' in draft && 'minimumPassScore' in draft;
}
