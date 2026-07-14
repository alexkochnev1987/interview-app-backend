import { Locale } from '../../locale/locale.constants';
import { localeUiText } from '../../locale/locale-ui-text';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import {
  isPlainRecord,
  parseJsonFromModelOutput,
} from './parse-model-json';
import type { CandidateFeedbackQuestionSourceText } from '../../feedback/candidate-feedback-source-text';

export interface RawCandidateFeedbackOverall {
  recommendationText: string;
  improvementText: string;
}

const CANDIDATE_FEEDBACK_OVERALL_SYSTEM = `You write constructive, candidate-facing overall interview feedback.
You receive the interview context and per-question feedback snippets that HR already approved or generated.
Synthesize them into one cohesive overall message for the candidate.
Do not mention internal scores, HR decisions, hiring outcomes, or that the text was assembled from multiple blocks.
Return ONLY a single JSON object. No markdown, no commentary.`;

export interface CandidateFeedbackOverallLlmInput {
  position: string;
  candidateName: string;
  questionTexts: Array<{
    questionIndex: number;
    questionText: string;
    recommendationText?: string;
    improvementText?: string;
  }>;
  interviewLocale: Locale;
}

export function buildCandidateFeedbackOverallUserPrompt(
  input: CandidateFeedbackOverallLlmInput,
): string {
  const { responseLanguageName } = localeUiText(input.interviewLocale);

  return `Write overall candidate-facing interview feedback.

Interview context (JSON):
${JSON.stringify({
  position: input.position,
  candidateName: input.candidateName,
})}

Per-question feedback snippets to synthesize (JSON):
${JSON.stringify(input.questionTexts)}

Output a single JSON object with these camelCase keys:
- recommendationText (string): overall strengths and what went well across the interview, 3-5 sentences in ${responseLanguageName}.
- improvementText (string): overall growth areas and next steps, 3-5 sentences in ${responseLanguageName}.
Use only the provided per-question snippets; do not invent detailed claims about answers that were not included.`;
}

function parseCandidateFeedbackOverallShape(
  value: unknown,
): RawCandidateFeedbackOverall | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const recommendationText = value.recommendationText;
  const improvementText = value.improvementText;
  if (
    typeof recommendationText !== 'string' ||
    !recommendationText.trim() ||
    typeof improvementText !== 'string' ||
    !improvementText.trim()
  ) {
    return undefined;
  }

  return {
    recommendationText: recommendationText.trim(),
    improvementText: improvementText.trim(),
  };
}

export async function generateCandidateFeedbackOverallWithNativeLlm(
  config: NativeProviderConfig,
  input: CandidateFeedbackOverallLlmInput,
): Promise<RawCandidateFeedbackOverall> {
  const user = buildCandidateFeedbackOverallUserPrompt(input);
  const raw = await completeJson(
    config,
    CANDIDATE_FEEDBACK_OVERALL_SYSTEM,
    user,
  );
  const parsed = parseCandidateFeedbackOverallShape(
    parseJsonFromModelOutput(raw),
  );
  if (!parsed) {
    throw new Error('LLM returned invalid overall candidate feedback JSON.');
  }
  return parsed;
}

export function buildOverallQuestionTextsInput(
  sourceTexts: CandidateFeedbackQuestionSourceText[],
  questionTextByIndex: Map<number, string>,
): CandidateFeedbackOverallLlmInput['questionTexts'] {
  return sourceTexts.map((item) => ({
    questionIndex: item.questionIndex,
    questionText:
      questionTextByIndex.get(item.questionIndex) ??
      `Question ${item.questionIndex + 1}`,
    recommendationText: item.recommendationText,
    improvementText: item.improvementText,
  }));
}
