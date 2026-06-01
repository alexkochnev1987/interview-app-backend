import { Locale } from '../locale/locale.constants';

export interface EvaluationLocaleText {
  responseLanguageName: string;
  questionLabel: (questionNumber: number) => string;
  scoreSuffix: (score: number) => string;
  reviewThisArea: string;
  noPerQuestionSummaries: string;
  summaryQuestionLine: (questionNumber: number, summary: string) => string;
  similarSameCategory: (category: string) => string;
  similarSameSubcategory: (subcategory: string) => string;
  similarSameRole: (role: string) => string;
  similarSameDifficulty: (difficulty: string) => string;
}

const TEXT_BY_LOCALE: Record<Locale, EvaluationLocaleText> = {
  en: {
    responseLanguageName: 'English',
    questionLabel: (n) => `Question ${n}`,
    scoreSuffix: (score) => ` (${Math.round(score)}%)`,
    reviewThisArea: 'Review this area.',
    noPerQuestionSummaries: 'No per-question summaries were produced.',
    summaryQuestionLine: (n, summary) => `Q${n}: ${summary}`,
    similarSameCategory: (category) => `Same category: ${category}`,
    similarSameSubcategory: (subcategory) => `Same subcategory: ${subcategory}`,
    similarSameRole: (role) => `Same role: ${role}`,
    similarSameDifficulty: (difficulty) => `Same difficulty: ${difficulty}`,
  },
  pl: {
    responseLanguageName: 'Polish',
    questionLabel: (n) => `Pytanie ${n}`,
    scoreSuffix: (score) => ` (${Math.round(score)}%)`,
    reviewThisArea: 'Wymaga poprawy w tym obszarze.',
    noPerQuestionSummaries: 'Brak podsumowań dla poszczególnych pytań.',
    summaryQuestionLine: (n, summary) => `P${n}: ${summary}`,
    similarSameCategory: (category) => `Ta sama kategoria: ${category}`,
    similarSameSubcategory: (subcategory) => `Ta sama podkategoria: ${subcategory}`,
    similarSameRole: (role) => `Ta sama rola: ${role}`,
    similarSameDifficulty: (difficulty) => `Ten sam poziom trudności: ${difficulty}`,
  },
  ru: {
    responseLanguageName: 'Russian',
    questionLabel: (n) => `Вопрос ${n}`,
    scoreSuffix: (score) => ` (${Math.round(score)}%)`,
    reviewThisArea: 'Требуется доработка в этой области.',
    noPerQuestionSummaries: 'Нет кратких выводов по отдельным вопросам.',
    summaryQuestionLine: (n, summary) => `В${n}: ${summary}`,
    similarSameCategory: (category) => `Та же категория: ${category}`,
    similarSameSubcategory: (subcategory) => `Та же подкатегория: ${subcategory}`,
    similarSameRole: (role) => `Та же роль: ${role}`,
    similarSameDifficulty: (difficulty) => `Тот же уровень сложности: ${difficulty}`,
  },
  be: {
    responseLanguageName: 'Belarusian',
    questionLabel: (n) => `Пытанне ${n}`,
    scoreSuffix: (score) => ` (${Math.round(score)}%)`,
    reviewThisArea: 'Патрабуе паляпшэння ў гэтай вобласці.',
    noPerQuestionSummaries: 'Няма кароткіх вывадаў па асобных пытаннях.',
    summaryQuestionLine: (n, summary) => `П${n}: ${summary}`,
    similarSameCategory: (category) => `Тая ж катэгорыя: ${category}`,
    similarSameSubcategory: (subcategory) => `Тая ж падкатэгорыя: ${subcategory}`,
    similarSameRole: (role) => `Тая ж роля: ${role}`,
    similarSameDifficulty: (difficulty) => `Той ж узровень складанасці: ${difficulty}`,
  },
};

export function evaluationLocaleText(locale: Locale): EvaluationLocaleText {
  return TEXT_BY_LOCALE[locale];
}
