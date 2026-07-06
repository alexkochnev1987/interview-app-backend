import { SUPPORTED_LOCALES } from '../locale/locale.constants';
import { QuestionTranslations } from './interfaces/question.interface';

export type QuestionTranslationsMode = 'merge' | 'replace';

export function applyTranslationsUpdate(
  existing: QuestionTranslations,
  incoming: QuestionTranslations,
  mode: QuestionTranslationsMode,
): QuestionTranslations {
  if (mode === 'replace') {
    return { ...incoming };
  }

  const merged: QuestionTranslations = { ...existing };
  for (const locale of SUPPORTED_LOCALES) {
    const block = incoming[locale];
    if (block) {
      merged[locale] = block;
    }
  }
  return merged;
}
