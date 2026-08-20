import { Locale } from '../../locale/locale.constants';

export type QuestionRedFlagSeverity = 'low' | 'medium' | 'high';

export interface QuestionExpectedConcept {
  id: string;
  label: string;
  weight: number;
  description: string;
}

export interface QuestionRedFlag {
  id: string;
  label: string;
  severity: QuestionRedFlagSeverity;
}

export interface QuestionTranslation {
  questionText: string;
  followUpQuestions?: string[];
  expectedConcepts?: QuestionExpectedConcept[];
  redFlags?: QuestionRedFlag[];
  sampleGoodAnswer?: string;
}

export type QuestionTranslations = Partial<Record<Locale, QuestionTranslation>>;

export type QuestionTranslationsMode = 'merge' | 'replace';

export interface QuestionPrimaryLocaleHolder {
  primaryLocale?: Locale;
}

export interface UpdateQuestionTranslationsContext extends QuestionPrimaryLocaleHolder {
  translationsMode?: QuestionTranslationsMode;
}
