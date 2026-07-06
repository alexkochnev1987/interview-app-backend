import { Locale } from '../locale/locale.constants';
import {
  QuestionDraft,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../question/interfaces/question.interface';

export function collectRubricHumanReadableTexts(draft: {
  followUpQuestions?: string[];
  expectedConcepts?: QuestionExpectedConcept[];
  redFlags?: QuestionRedFlag[];
  sampleGoodAnswer?: string;
}): string[] {
  return [
    ...(draft.followUpQuestions ?? []),
    ...(draft.expectedConcepts ?? []).flatMap((item) =>
      [item.label, item.description ?? ''].filter(Boolean),
    ),
    ...(draft.redFlags ?? []).map((item) => item.label),
    draft.sampleGoodAnswer ?? '',
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

export function rubricTextsMatchLocale(locale: Locale, texts: string[]): boolean {
  if (texts.length === 0) {
    return false;
  }

  const text = texts.join(' ');
  const hasCyrillic = /[А-Яа-яЁёІіЎў]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  const hasBelarusianGlyphs = /[іІўЎґҐ]/.test(text);

  if (locale === 'be') {
    return hasCyrillic && hasBelarusianGlyphs;
  }
  if (locale === 'ru') {
    return hasCyrillic;
  }
  if (locale === 'en') {
    return !hasCyrillic;
  }

  if (hasCyrillic) {
    return false;
  }
  const hasPolishHint =
    /[ąćęłńóśźż]/i.test(text) ||
    /\b(jak|który|różnica|wyjaśnij|oraz|czy|możesz|błęd)\b/i.test(text);
  return hasPolishHint || !hasLatin;
}

export function draftRubricMatchesLocale(
  draft: Pick<
    QuestionDraft,
    'followUpQuestions' | 'expectedConcepts' | 'redFlags' | 'sampleGoodAnswer'
  >,
  locale: Locale,
): boolean {
  return rubricTextsMatchLocale(locale, collectRubricHumanReadableTexts(draft));
}

export function conceptAndRedFlagIdsAreLatinSnakeCase(draft: {
  expectedConcepts?: QuestionExpectedConcept[];
  redFlags?: QuestionRedFlag[];
}): boolean {
  const ids = [
    ...(draft.expectedConcepts ?? []).map((item) => item.id),
    ...(draft.redFlags ?? []).map((item) => item.id),
  ].filter(Boolean);
  if (ids.length === 0) {
    return false;
  }
  return ids.every((id) => /^[a-z][a-z0-9_]*$/.test(id));
}
