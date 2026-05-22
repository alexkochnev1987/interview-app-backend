import type { QuestionDraft } from '../../question/interfaces/question.interface';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import { parseJsonFromModelOutput } from './parse-model-json';

const QUESTION_DRAFT_SYSTEM = `You enrich structured technical interview questions for hiring teams.
Return only valid JSON matching the requested shape. Use camelCase keys.
Always populate every key in the requested shape; never omit a key.
Evaluate each key independently from the question text, then return your own judgment — even if it matches the input.
Weights for expectedConcepts must sum to 1 across items (approximately).
difficulty must be one of: easy, medium, hard.
Difficulty rubric — judge from the question text only. Do not infer difficulty from category, subcategory, tags, or any role hint:
- easy: junior fundamentals, single concept, short answer expected (e.g. "What is a closure?").
- medium: mid-level question requiring multiple connected concepts or basic trade-off reasoning (e.g. "Explain how React's reconciliation works and when it is expensive").
- hard: senior depth — multi-system reasoning, architecture design, migration strategy, performance under constraints, or open-ended trade-off analysis across more than two technologies (e.g. "Design a rendering strategy for a multi-tenant SaaS dashboard balancing SSR, ISR, and CSR").
Be decisive. If the question describes a system to design or asks the candidate to weigh trade-offs across multiple technologies, choose "hard" — do not hedge to "medium".
redFlags severity must be one of: low, medium, high.
minimumPassScore is between 0 and 5. Anchor it to your judged difficulty (easy ~2.5, medium ~3, hard ~3.5).
weight should reflect interview signal value (easy ~1, medium ~2, hard ~3).
For role: derive from question content. Use "senior frontend engineer" / "senior backend engineer" / "staff engineer" for hard system-design or architecture questions; use "frontend intern" / "junior engineer" only for easy fundamentals.
For focus: pick "system design", "architecture", "performance", "testing", or "fundamentals" based on the question's core ask.
followUpQuestions must always contain at least 2 probes (3-5 ideal) — concrete follow-ups an interviewer would ask to verify depth.
expectedConcepts must always contain at least 3 entries — the concepts a strong answer would cover, with weights summing to ~1.
redFlags must always contain at least 2 entries — common wrong answers or missing concepts that should lower the score.
tags must always contain at least 3 entries — short topic keywords for filtering and search.
sampleGoodAnswer must always be a populated multi-sentence string — never empty.
Never return empty arrays for followUpQuestions, expectedConcepts, redFlags, or tags. Generate them from the question text.`;

export function buildQuestionDraftUserPrompt(base: Partial<QuestionDraft>): string {
  return `Assess and complete this question draft. Keep the same topic; refine wording, rubric, and metadata.
Judge role, focus, difficulty, weight, minimumPassScore, follow-ups, expected concepts, red flags, sample answer, and tags from the question text. Empty/missing fields in the input below must be generated from scratch — never echo empty.

Input JSON:
${JSON.stringify(base)}

Output a single JSON object with these camelCase keys. Every key is required.
- externalId (string) — propose a short slug like "frontend_closures_v1" when the input has none.
- role (string) — e.g. "frontend intern", "backend engineer". Infer from the question if missing.
- focus (string) — e.g. "fundamentals", "system design". Infer from the question if missing.
- outputLanguage (string) — default to "English" when unclear.
- category (string)
- subcategory (string)
- questionText (string)
- followUpQuestions (string[])
- expectedConcepts: array of { "id", "label", "weight", "description" }
- redFlags: array of { "id", "label", "severity" }
- difficulty: "easy" | "medium" | "hard"
- weight (number, positive)
- sampleGoodAnswer (string)
- minimumPassScore (number)
- tags (string[])
- metadata (object; preserve and extend input metadata when useful)`;
}

export async function generateQuestionDraftWithNativeLlm(
  config: NativeProviderConfig,
  base: Partial<QuestionDraft>,
): Promise<unknown> {
  const user = buildQuestionDraftUserPrompt(base);
  const raw = await completeJson(
    config,
    QUESTION_DRAFT_SYSTEM,
    user,
  );
  return parseJsonFromModelOutput(raw);
}
