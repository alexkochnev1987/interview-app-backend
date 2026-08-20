import { DEFAULT_LOCALE, type Locale } from '../locale/locale.constants';
import {
  isQuestionFeedbackEligibilitySkipReason,
  type QuestionFeedbackEligibilitySkipReason,
  type QuestionFeedbackGenerationSkipReason,
} from './candidate-feedback-eligibility';

export type { QuestionFeedbackEligibilitySkipReason } from './candidate-feedback-eligibility';
export { isQuestionFeedbackEligibilitySkipReason } from './candidate-feedback-eligibility';

export interface CandidateFeedbackSkipTemplateTexts {
  recommendationText: string;
  improvementText: string;
  hrHint: QuestionFeedbackEligibilitySkipReason;
}

const QUESTION_SNIPPET_MAX_LENGTH = 120;

interface LocaleSkipTemplates {
  noAnswerSubmitted: string;
  missingTranscript: string;
  unusableTranscript: string;
  defaultRecommendation: string;
  improvement: (questionSnippet: string) => string;
}

const TEMPLATES: Record<Locale, LocaleSkipTemplates> = {
  en: {
    noAnswerSubmitted: 'No answer was submitted for this question.',
    missingTranscript: 'We could not review a spoken answer for this question.',
    unusableTranscript:
      'The recorded response did not contain a substantive answer to this question.',
    defaultRecommendation:
      'We did not receive a substantive answer to this question, so we cannot highlight specific strengths on this topic.',
    improvement: (questionSnippet) =>
      `We recommend revisiting this topic and preparing a clearer answer with a concrete example related to: ${questionSnippet}.`,
  },
  ru: {
    noAnswerSubmitted: 'На этот вопрос не был отправлен ответ.',
    missingTranscript: 'Мы не смогли просмотреть устный ответ на этот вопрос.',
    unusableTranscript:
      'Записанный ответ не содержал содержательного ответа на этот вопрос.',
    defaultRecommendation:
      'Мы не получили содержательный ответ на этот вопрос, поэтому не можем отметить конкретные сильные стороны по этой теме.',
    improvement: (questionSnippet) =>
      `Мы рекомендуем вернуться к этой теме и подготовить более чёткий ответ с конкретным примером, связанным с: ${questionSnippet}.`,
  },
  pl: {
    noAnswerSubmitted: 'Na to pytanie nie przesłano odpowiedzi.',
    missingTranscript:
      'Nie mogliśmy przejrzeć ustnej odpowiedzi na to pytanie.',
    unusableTranscript:
      'Nagrana odpowiedź nie zawierała merytorycznej odpowiedzi na to pytanie.',
    defaultRecommendation:
      'Nie otrzymaliśmy merytorycznej odpowiedzi na to pytanie, więc nie możemy wskazać konkretnych mocnych stron w tym obszarze.',
    improvement: (questionSnippet) =>
      `Zalecamy powrót do tego tematu i przygotowanie jaśniejszej odpowiedzi z konkretnym przykładem związanym z: ${questionSnippet}.`,
  },
  be: {
    noAnswerSubmitted: 'На гэтае пытанне адказ не быў дасланы.',
    missingTranscript: 'Мы не змаглі праглядзець вусны адказ на гэтае пытанне.',
    unusableTranscript:
      'Запісаны адказ не змяшчаў змесцевага адказу на гэтае пытанне.',
    defaultRecommendation:
      'Мы не атрымалі змесцевы адказ на гэтае пытанне, таму не можам вылучыць канкрэтныя моцныя бакі ў гэтай тэме.',
    improvement: (questionSnippet) =>
      `Мы рэкамендуем вярнуцца да гэтай тэмы і падрыхтаваць больш зразумелы адказ з канкрэтным прыкладам, які адносіцца да: ${questionSnippet}.`,
  },
};

function buildQuestionSnippet(
  questionText: string | undefined,
  maxLength = QUESTION_SNIPPET_MAX_LENGTH,
): string {
  const trimmed = questionText?.trim().replace(/\s+/g, ' ') ?? '';
  if (!trimmed) {
    return 'this question';
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function resolveRecommendationText(
  templates: LocaleSkipTemplates,
  reason: QuestionFeedbackEligibilitySkipReason,
): string {
  switch (reason) {
    case 'not_submitted':
    case 'missing_answer':
      return templates.noAnswerSubmitted;
    case 'missing_transcript':
      return templates.missingTranscript;
    case 'unusable_transcript':
      return templates.unusableTranscript;
    default:
      return templates.defaultRecommendation;
  }
}

export function buildSkipTemplateTexts(
  reason: QuestionFeedbackGenerationSkipReason,
  questionText: string | undefined,
  interviewLocale: string | undefined,
): CandidateFeedbackSkipTemplateTexts | null {
  if (!isQuestionFeedbackEligibilitySkipReason(reason)) {
    return null;
  }

  const locale: Locale =
    interviewLocale && interviewLocale in TEMPLATES
      ? (interviewLocale as Locale)
      : DEFAULT_LOCALE;
  const templates = TEMPLATES[locale];
  const questionSnippet = buildQuestionSnippet(questionText);

  return {
    recommendationText: resolveRecommendationText(templates, reason),
    improvementText: templates.improvement(questionSnippet),
    hrHint: reason,
  };
}
