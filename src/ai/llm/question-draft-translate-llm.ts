import { readFileSync } from 'fs';
import { join } from 'path';
import { Locale } from '../../locale/locale.constants';
import { localeUiText } from '../../locale/locale-ui-text';
import type { QuestionDraftContent } from '../question-draft-content';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import { parseJsonFromModelOutput } from './parse-model-json';

export interface QuestionTranslateFullInput {
  sourceLocale: Locale;
  targetLocale: Locale;
  content: Omit<QuestionDraftContent, 'primaryLocale'>;
}

let cachedTranslateFullSystemPrompt: string | undefined;

export function loadQuestionTranslateFullSystemPrompt(): string {
  if (!cachedTranslateFullSystemPrompt) {
    cachedTranslateFullSystemPrompt = readFileSync(
      join(__dirname, '..', 'prompts', 'translate-full.md'),
      'utf8',
    ).trim();
  }
  return cachedTranslateFullSystemPrompt;
}

export function buildQuestionTranslateFullUserPrompt(
  input: QuestionTranslateFullInput,
): string {
  const sourceName = localeUiText(input.sourceLocale).responseLanguageName;
  const targetName = localeUiText(input.targetLocale).responseLanguageName;

  return `Translate the primary locale content block from ${sourceName} (${input.sourceLocale}) to ${targetName} (${input.targetLocale}).

Preserve every \`id\` in expectedConcepts and redFlags exactly.
Preserve concept \`weight\` and red-flag \`severity\` exactly.
Translate questionText, followUpQuestions, concept labels/descriptions, red-flag labels, and sampleGoodAnswer.

Source JSON:
${JSON.stringify({
  sourceLocale: input.sourceLocale,
  targetLocale: input.targetLocale,
  ...input.content,
})}

Output a single JSON object with ONLY these camelCase keys:
- questionText (string)
- followUpQuestions (string[])
- expectedConcepts: array of { "id", "label", "weight", "description" } — ids unchanged from source
- redFlags: array of { "id", "label", "severity" } — ids and severities unchanged from source
- sampleGoodAnswer (string)`;
}

export async function translateQuestionContentWithNativeLlm(
  config: NativeProviderConfig,
  input: QuestionTranslateFullInput,
): Promise<unknown> {
  const user = buildQuestionTranslateFullUserPrompt(input);
  const raw = await completeJson(
    config,
    loadQuestionTranslateFullSystemPrompt(),
    user,
  );
  return parseJsonFromModelOutput(raw);
}
