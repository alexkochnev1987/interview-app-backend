import { SUPPORTED_LOCALES } from '../locale/locale.constants';
import { QuestionTranslations } from './interfaces/question.interface';

/** Lowercased, space-joined distinct question texts for ILIKE / pg_trgm search. */
export function buildQuestionSearchText(
  questionText: string,
  translations: QuestionTranslations,
): string {
  const parts = new Set<string>();
  const add = (value?: string | null): void => {
    const trimmed = value?.trim();
    if (trimmed) {
      parts.add(trimmed);
    }
  };

  add(questionText);
  for (const locale of SUPPORTED_LOCALES) {
    add(translations[locale]?.questionText);
  }

  return [...parts].join(' ').toLowerCase();
}

/** Distinct non-empty question texts (lowercased) for duplicate checks. */
export function collectQuestionTextVariants(
  questionText: string,
  translations: QuestionTranslations,
): string[] {
  const variants = new Set<string>();
  const add = (value?: string | null): void => {
    const trimmed = value?.trim();
    if (trimmed) {
      variants.add(trimmed.toLowerCase());
    }
  };

  add(questionText);
  for (const locale of SUPPORTED_LOCALES) {
    add(translations[locale]?.questionText);
  }

  return [...variants];
}
