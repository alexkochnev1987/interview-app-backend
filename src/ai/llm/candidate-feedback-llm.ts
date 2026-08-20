import type { QuestionFeedbackToneMode } from '../../feedback/candidate-feedback-eligibility';
import type {
  AnswerBehaviorSignals,
  AnswerDecisionHint,
  InterviewQuestion,
} from '../../interview/interfaces/interview.interface';
import { localeUiText } from '../../locale/locale-ui-text';
import { Locale } from '../../locale/locale.constants';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import { isPlainRecord, parseJsonFromModelOutput } from './parse-model-json';

export interface RawCandidateFeedbackQuestion {
  recommendationText: string;
  improvementText: string;
}

export interface CandidateFeedbackEvaluationContext {
  summary?: string;
  decisionHint?: AnswerDecisionHint;
  categoryScores?: Record<string, number>;
  overallScore?: number;
}

const SHARED_CANDIDATE_FEEDBACK_GUARDRAILS = `Do not mention internal scores, hiring decisions, reject/proceed outcomes, HR internal labels, ideal model answers, pass thresholds, or raw signal counts.
Translate behavior concerns into gentle, professional guidance only when clearly relevant.
Return ONLY a single JSON object. No markdown, no commentary.`;

const TONE_SYSTEM_PROMPTS: Record<QuestionFeedbackToneMode, string> = {
  balanced: `You write constructive, candidate-facing interview feedback for one question.
You receive the question context, the candidate's spoken answer transcript, optional internal evaluation context, and integrity/behavior signals from the take session.
Write empathetically for the candidate: highlight genuine strengths in recommendationText and actionable growth areas in improvementText.
${SHARED_CANDIDATE_FEEDBACK_GUARDRAILS}`,
  growth_focused: `You write constructive, candidate-facing interview feedback for one question.
You receive the question context, transcript, optional internal evaluation context, and behavior signals.
The answer showed mixed or developing performance. Mention modest strengths only when clearly supported by the transcript; emphasize specific, respectful improvements in improvementText.
Avoid exaggerated praise or generic encouragement not grounded in what was said.
${SHARED_CANDIDATE_FEEDBACK_GUARDRAILS}`,
  honest_weak: `You write respectful, candidate-facing interview feedback for one question.
You receive the question context, transcript, optional internal evaluation context, and behavior signals.
The answer was weak, off-topic, or did not adequately address the question. Do NOT invent strengths or false praise.
In recommendationText, acknowledge sincere effort only when the transcript shows a real attempt; otherwise keep recommendationText brief and neutral.
In improvementText, give specific, respectful growth areas tied to the question and what was actually said.
${SHARED_CANDIDATE_FEEDBACK_GUARDRAILS}`,
  transcript_only: `You write cautious, candidate-facing interview feedback for one question.
You receive the question context, transcript, and behavior signals only — automated evaluation is unavailable.
Base feedback strictly on what appears in the transcript. Do not invent strengths, depth, or technical accuracy that is not evidenced.
Keep recommendationText modest; focus improvementText on concrete next steps the candidate could try when answering similar questions.
${SHARED_CANDIDATE_FEEDBACK_GUARDRAILS}`,
};

const TONE_USER_INSTRUCTIONS: Record<QuestionFeedbackToneMode, string> = {
  balanced:
    'Tone: balanced. recommendationText may include genuine strengths and what went well; improvementText should include actionable growth areas.',
  growth_focused:
    'Tone: growth-focused. Include modest strengths only when clearly supported; emphasize improvements and next steps.',
  honest_weak:
    'Tone: honest but respectful. No false praise. Be specific about growth areas without shaming the candidate.',
  transcript_only:
    'Tone: transcript-only. No invented strengths. Stay cautious and grounded in the transcript.',
};

export function getCandidateFeedbackQuestionSystemPrompt(
  toneMode: QuestionFeedbackToneMode,
): string {
  return TONE_SYSTEM_PROMPTS[toneMode];
}

export interface CandidateFeedbackQuestionLlmInput {
  question: InterviewQuestion;
  transcriptText: string;
  behaviorSignals: AnswerBehaviorSignals;
  durationSeconds?: number;
  interviewLocale: Locale;
  toneMode: QuestionFeedbackToneMode;
  evaluationContext?: CandidateFeedbackEvaluationContext;
}

function buildCandidateFeedbackQuestionUserPrompt(
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

  const internalEvaluation = input.evaluationContext
    ? {
        summary: input.evaluationContext.summary,
        decisionHint: input.evaluationContext.decisionHint,
        categoryScores: input.evaluationContext.categoryScores,
        overallScore: input.evaluationContext.overallScore,
      }
    : undefined;

  return `Write candidate-facing feedback for one interview answer.

${TONE_USER_INSTRUCTIONS[input.toneMode]}

Rubric (JSON):
${JSON.stringify(rubric)}

Candidate transcript:
"""
${input.transcriptText}
"""

Internal evaluation context for tone only — do NOT copy verbatim into candidate text (JSON):
${JSON.stringify(internalEvaluation ?? null)}

Take-session behavior signals (JSON):
${JSON.stringify(behavior)}

Output a single JSON object with these camelCase keys:
- recommendationText (string): candidate-facing strengths or neutral acknowledgment, 2-4 sentences in ${responseLanguageName}.
- improvementText (string): specific, actionable growth areas, 2-4 sentences in ${responseLanguageName}.
Base feedback on what was actually said in the transcript. Use internal evaluation only to calibrate tone, not to quote scores or hiring labels.`;
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
  const system = getCandidateFeedbackQuestionSystemPrompt(input.toneMode);
  const raw = await completeJson(config, system, user);
  const parsed = parseCandidateFeedbackQuestionShape(
    parseJsonFromModelOutput(raw),
  );
  if (!parsed) {
    throw new Error('LLM returned invalid candidate feedback JSON.');
  }
  return parsed;
}
