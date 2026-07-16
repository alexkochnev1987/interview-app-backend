import type {
  AnswerBehaviorSignals,
  InterviewQuestion,
} from '../../interview/interfaces/interview.interface';
import { localeUiText } from '../../locale/locale-ui-text';
import { Locale } from '../../locale/locale.constants';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import {
  isPlainRecord,
  parseJsonFromModelOutput,
} from './parse-model-json';

export interface RawCandidateFeedbackQuestion {
  recommendationText: string;
  improvementText: string;
}

const CANDIDATE_FEEDBACK_QUESTION_SYSTEM = `You write constructive, candidate-facing interview feedback for one question.
You receive the question context, the candidate's spoken answer transcript, and integrity/behavior signals from the take session.
Write empathetically for the candidate: highlight genuine strengths in recommendationText and actionable growth areas in improvementText.
Do not mention internal scores, HR decisions, hiring outcomes, ideal model answers, pass thresholds, or raw signal counts — translate behavior concerns into gentle, professional guidance when relevant.
Return ONLY a single JSON object. No markdown, no commentary.`;

export interface CandidateFeedbackQuestionLlmInput {
  question: InterviewQuestion;
  transcriptText: string;
  behaviorSignals: AnswerBehaviorSignals;
  durationSeconds?: number;
  interviewLocale: Locale;
}

export function buildCandidateFeedbackQuestionUserPrompt(
  input: CandidateFeedbackQuestionLlmInput,
): string {
  const { responseLanguageName } = localeUiText(input.interviewLocale);
  const expectedConcepts = input.question.expectedConcepts.map((concept) => ({
    label: concept.label,
    description: concept.description,
  }));

  const rubric = {
    questionText: input.question.questionText,
    role: input.question.role,
    focus: input.question.focus,
    category: input.question.category,
    subcategory: input.question.subcategory,
    difficulty: input.question.difficulty,
    expectedConcepts,
    outputLanguage: input.question.outputLanguage,
  };

  const behavior = {
    tabHiddenCount: input.behaviorSignals.tabHiddenCount,
    windowBlurCount: input.behaviorSignals.windowBlurCount,
    pasteCount: input.behaviorSignals.pasteCount,
    keydownCount: input.behaviorSignals.keydownCount,
    copyCount: input.behaviorSignals.copyCount,
    resizeCount: input.behaviorSignals.resizeCount,
    durationSeconds: input.durationSeconds,
  };

  return `Write candidate-facing feedback for one interview answer.

Rubric (JSON):
${JSON.stringify(rubric)}

Candidate transcript:
"""
${input.transcriptText}
"""

Take-session behavior signals (JSON):
${JSON.stringify(behavior)}

Output a single JSON object with these camelCase keys:
- recommendationText (string): strengths and what went well, 2-4 sentences in ${responseLanguageName}.
- improvementText (string): specific, actionable growth areas, 2-4 sentences in ${responseLanguageName}.
Base feedback on what was actually said in the transcript. Use behavior signals only to inform tone about focus/integrity when clearly relevant.`;
}

function parseCandidateFeedbackQuestionShape(
  value: unknown,
): RawCandidateFeedbackQuestion | undefined {
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

export async function generateCandidateFeedbackQuestionWithNativeLlm(
  config: NativeProviderConfig,
  input: CandidateFeedbackQuestionLlmInput,
): Promise<RawCandidateFeedbackQuestion> {
  const user = buildCandidateFeedbackQuestionUserPrompt(input);
  const raw = await completeJson(
    config,
    CANDIDATE_FEEDBACK_QUESTION_SYSTEM,
    user,
  );
  const parsed = parseCandidateFeedbackQuestionShape(
    parseJsonFromModelOutput(raw),
  );
  if (!parsed) {
    throw new Error('LLM returned invalid candidate feedback JSON.');
  }
  return parsed;
}
