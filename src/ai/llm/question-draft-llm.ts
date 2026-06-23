import { readFileSync } from 'fs';
import { join } from 'path';
import type { QuestionDraft } from '../../question/interfaces/question.interface';
import { localeUiText } from '../../locale/locale-ui-text';
import { Locale } from '../../locale/locale.constants';
import { primaryLocaleToOutputLanguage } from '../../question/question-locale';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import { parseJsonFromModelOutput } from './parse-model-json';

export interface QuestionGenerateLlmInput {
  questionText: string;
  metadata?: Record<string, unknown>;
}

let cachedGenerateSystemPrompt: string | undefined;

export function loadQuestionGenerateSystemPrompt(): string {
  if (!cachedGenerateSystemPrompt) {
    cachedGenerateSystemPrompt = readFileSync(
      join(__dirname, '..', 'prompts', 'generate.md'),
      'utf8',
    ).trim();
  }
  return cachedGenerateSystemPrompt;
}

function buildQuestionDraftLocaleBlock(
  draftLocale: Locale,
  options: { strictLocale?: boolean } = {},
): string {
  const { responseLanguageName } = localeUiText(draftLocale);
  const strictLocaleLine = options.strictLocale
    ? `STRICT LOCALE MODE: Every human-readable rubric value MUST be in ${responseLanguageName} (${draftLocale}). If any value is in another language, regenerate before responding.`
    : '';

  const noEnglishBoilerplate =
    draftLocale === 'en'
      ? ''
      : 'Do not use English boilerplate templates for rubric text.';

  return `Output locale: ${draftLocale} (${responseLanguageName}).

Write ALL human-readable rubric text in ${responseLanguageName}:
- follow-up questions
- expected concept labels and descriptions
- red flag labels
- sample good answer
- questionText (refine or translate to match the output locale when needed)

Keep technical identifiers in English ASCII:
- concept and red-flag ids: snake_case Latin (e.g. concept_1, incorrect_runtime_explanation)

The interviewer seed question text may be in any language; match the rubric language to the requested locale (${draftLocale}), not to the seed language.
${noEnglishBoilerplate}
${strictLocaleLine}`.trim();
}

export function buildQuestionGenerateUserPrompt(
  base: QuestionGenerateLlmInput,
  draftLocale: Locale,
  options: { strictLocale?: boolean } = {},
): string {
  const outputLanguage = primaryLocaleToOutputLanguage(draftLocale);
  const localeBlock = buildQuestionDraftLocaleBlock(draftLocale, options);

  return `Generate a complete interview question draft (identity + primary locale rubric).
Use optional metadata only as context — do not echo a metadata object in the output.

${localeBlock}

Input JSON:
${JSON.stringify(base)}

Output a single JSON object with these camelCase keys:

Identity (infer from questionText and metadata hints):
- externalId (string, snake_case slug)
- role, focus, category, subcategory (strings)
- difficulty (easy|medium|hard)
- weight (number)
- minimumPassScore (number, 0–5)
- tags (string[])

Rubric content (human-readable text in ${outputLanguage}):
- questionText (string)
- followUpQuestions (string[])
- expectedConcepts: array of { "id", "label", "weight", "description" } — id in snake_case Latin; label and description in ${outputLanguage}
- redFlags: array of { "id", "label", "severity" } — id in snake_case Latin; label in ${outputLanguage}; severity low|medium|high
- sampleGoodAnswer (string)

Do not output primaryLocale, outputLanguage, or metadata.`;
}

/** @deprecated Legacy full-draft prompt — kept for reference; generate mode uses generate.md */
export function buildQuestionDraftUserPrompt(
  base: Partial<QuestionDraft>,
  draftLocale: Locale,
  options: { strictLocale?: boolean } = {},
): string {
  return buildQuestionGenerateUserPrompt(
    {
      questionText: base.questionText ?? '',
      ...(base.metadata && Object.keys(base.metadata).length > 0
        ? { metadata: base.metadata }
        : {}),
    },
    draftLocale,
    options,
  );
}

export async function generateQuestionDraftWithNativeLlm(
  config: NativeProviderConfig,
  base: QuestionGenerateLlmInput,
  draftLocale: Locale,
  options: { strictLocale?: boolean } = {},
): Promise<unknown> {
  const user = buildQuestionGenerateUserPrompt(base, draftLocale, options);
  const raw = await completeJson(
    config,
    loadQuestionGenerateSystemPrompt(),
    user,
  );
  return parseJsonFromModelOutput(raw);
}
