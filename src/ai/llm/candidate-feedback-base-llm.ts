import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import { isPlainRecord, parseJsonFromModelOutput } from './parse-model-json';

export interface RawCandidateFeedbackResult {
  recommendationText: string;
  improvementText: string;
}

function parseCandidateFeedbackShape(
  value: unknown,
): RawCandidateFeedbackResult | undefined {
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

export async function executeCandidateFeedbackJsonLlm(
  config: NativeProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  errorMessage = 'LLM returned invalid candidate feedback JSON.',
): Promise<RawCandidateFeedbackResult> {
  const raw = await completeJson(config, systemPrompt, userPrompt);
  const parsed = parseCandidateFeedbackShape(parseJsonFromModelOutput(raw));
  if (!parsed) {
    throw new Error(errorMessage);
  }
  return parsed;
}
