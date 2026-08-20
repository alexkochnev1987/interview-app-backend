import type { OverallFeedbackToneMode } from '../../feedback/candidate-feedback-eligibility';
import type { OverallInterviewMixMetadata } from '../../feedback/candidate-feedback-overall-tone';
import { isMixedInterviewMetadata } from '../../feedback/candidate-feedback-overall-tone';
import type { CandidateFeedbackQuestionSourceText } from '../../feedback/candidate-feedback-source-text';
import { localeUiText } from '../../locale/locale-ui-text';
import { Locale } from '../../locale/locale.constants';
import type { NativeProviderConfig } from './ai-env';
import {
  executeCandidateFeedbackJsonLlm,
  type RawCandidateFeedbackResult,
} from './candidate-feedback-base-llm';

export type RawCandidateFeedbackOverall = RawCandidateFeedbackResult;

const SHARED_OVERALL_GUARDRAILS = `Synthesize only from the provided per-question snippets.
Do not mention internal scores, HR decisions, hiring outcomes, reject/proceed labels, or that the text was assembled from multiple blocks.
Return ONLY a single JSON object. No markdown, no commentary.`;

const OVERALL_TONE_SYSTEM_PROMPTS: Record<OverallFeedbackToneMode, string> = {
  balanced: `You write constructive, candidate-facing overall interview feedback.
You receive the interview context and per-question feedback snippets that HR already approved or generated.
Synthesize them into one cohesive overall message with a balanced positive tone when supported by the snippets.
${SHARED_OVERALL_GUARDRAILS}`,
  growth_focused: `You write constructive, candidate-facing overall interview feedback.
You receive the interview context and per-question feedback snippets.
The interview showed mixed performance. Synthesize a growth-focused overall message: modest positives only when clearly supported; emphasize development areas and next steps.
Avoid calling it a strong interview or using inflated praise.
${SHARED_OVERALL_GUARDRAILS}`,
  honest_weak: `You write respectful, candidate-facing overall interview feedback.
You receive the interview context and per-question feedback snippets.
The interview outcome was weak overall. Do NOT call it a strong interview or use false praise.
Synthesize a development-focused overall message grounded only in the snippets: brief neutral acknowledgment where appropriate, specific growth areas in improvementText.
${SHARED_OVERALL_GUARDRAILS}`,
};

const OVERALL_TONE_USER_INSTRUCTIONS: Record<OverallFeedbackToneMode, string> =
  {
    balanced:
      'Overall tone: balanced positive synthesis when supported by the snippets.',
    growth_focused:
      'Overall tone: growth-focused synthesis with modest positives only when earned.',
    honest_weak:
      'Overall tone: respectful development focus. No false praise or "strong interview" language.',
  };

function getCandidateFeedbackOverallSystemPrompt(
  toneMode: OverallFeedbackToneMode,
): string {
  return OVERALL_TONE_SYSTEM_PROMPTS[toneMode];
}

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
  toneMode: OverallFeedbackToneMode;
  mixMetadata?: OverallInterviewMixMetadata;
}

function buildCandidateFeedbackOverallUserPrompt(
  input: CandidateFeedbackOverallLlmInput,
): string {
  const { responseLanguageName } = localeUiText(input.interviewLocale);
  const mixSummary =
    input.mixMetadata !== undefined
      ? `Interview mix summary (internal metadata — do not quote scores or labels to the candidate):
${JSON.stringify(input.mixMetadata)}

`
      : '';
  const mixedInstruction =
    input.mixMetadata !== undefined &&
    isMixedInterviewMetadata(input.mixMetadata)
      ? 'This was a mixed interview; do not describe overall performance as strong if most questions lacked substantive answers.\n\n'
      : '';

  return `Write overall candidate-facing interview feedback.

${OVERALL_TONE_USER_INSTRUCTIONS[input.toneMode]}

${mixSummary}${mixedInstruction}Interview context (JSON):
${JSON.stringify({
  position: input.position,
  candidateName: input.candidateName,
})}

Per-question feedback snippets to synthesize (JSON):
${JSON.stringify(input.questionTexts)}

Output a single JSON object with these camelCase keys:
- recommendationText (string): overall strengths or neutral synthesis, 3-5 sentences in ${responseLanguageName}.
- improvementText (string): overall growth areas and next steps, 3-5 sentences in ${responseLanguageName}.
Use only the provided per-question snippets; do not invent detailed claims about answers that were not included.`;
}

export async function generateCandidateFeedbackOverallWithNativeLlm(
  config: NativeProviderConfig,
  input: CandidateFeedbackOverallLlmInput,
): Promise<RawCandidateFeedbackOverall> {
  const user = buildCandidateFeedbackOverallUserPrompt(input);
  const system = getCandidateFeedbackOverallSystemPrompt(input.toneMode);
  return executeCandidateFeedbackJsonLlm(
    config,
    system,
    user,
    'LLM returned invalid overall candidate feedback JSON.',
  );
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
