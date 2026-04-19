import type { QuestionDraft } from '../../question/interfaces/question.interface';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import { parseJsonFromModelOutput } from './parse-model-json';

const QUESTION_DRAFT_SYSTEM = `You enrich structured technical interview questions for hiring teams.
Return only valid JSON matching the requested shape. Use camelCase keys.
Weights for expectedConcepts must sum to 1 across items (approximately).
difficulty must be one of: easy, medium, hard.
redFlags severity must be one of: low, medium, high.
minimumPassScore is between 0 and 5.`;

export function buildQuestionDraftUserPrompt(base: QuestionDraft): string {
  return `Improve and complete this question draft. Keep the same topic and intent as the input; refine wording, rubric, and metadata.

Input JSON:
${JSON.stringify(base)}

Output a single JSON object with these camelCase keys:
- externalId (string, optional)
- role (string, optional)
- focus (string, optional)
- outputLanguage (string)
- category (string)
- subcategory (string)
- questionText (string)
- followUpQuestions (string[])
- expectedConcepts: array of { "id", "label", "weight", "description" }
- redFlags: array of { "id", "label", "severity" }
- difficulty: "easy" | "medium" | "hard"
- weight (number, positive)
- sampleGoodAnswer (string, optional)
- minimumPassScore (number)
- tags (string[])
- metadata (object; preserve and extend input metadata when useful)`;
}

export async function generateQuestionDraftWithNativeLlm(
  config: NativeProviderConfig,
  base: QuestionDraft,
): Promise<unknown> {
  const user = buildQuestionDraftUserPrompt(base);
  const raw = await completeJson(
    config,
    QUESTION_DRAFT_SYSTEM,
    user,
  );
  return parseJsonFromModelOutput(raw);
}
