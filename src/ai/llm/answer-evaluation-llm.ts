import type { InterviewQuestion } from '../../interview/interfaces/interview.interface';
import { localeUiText } from '../../locale/locale-ui-text';
import { Locale } from '../../locale/locale.constants';
import type { NativeProviderConfig } from './ai-env';
import { completeJson } from './native-llm.adapter';
import {
  isPlainRecord,
  parseJsonFromModelOutput,
} from './parse-model-json';

export interface RawAnswerEvaluation {
  overallScore?: number;
  categoryScores?: Record<string, number>;
  coveredConceptIds?: string[];
  missedConceptIds?: string[];
  redFlagIds?: string[];
  summary?: string;
  decisionHint?: 'pass' | 'review' | 'fail';
}

const ANSWER_EVALUATION_SYSTEM = `You are a strict but fair interview reviewer.
You receive a single interview question with its rubric and a candidate's spoken answer transcript.
Score the answer ONLY on what was actually said. Do not penalize for spelling — the input is a speech-to-text transcript.
Write all natural-language fields (especially summary) in the response language requested in the user message.
Return ONLY a single JSON object. No markdown, no commentary.`;

export function buildAnswerEvaluationUserPrompt(
  question: InterviewQuestion,
  transcriptText: string,
  interviewLocale: Locale,
): string {
  const { responseLanguageName } = localeUiText(interviewLocale);
  const expectedConcepts = question.expectedConcepts.map((concept) => ({
    id: concept.id,
    label: concept.label,
    weight: concept.weight,
    description: concept.description,
  }));

  const redFlags = question.redFlags.map((flag) => ({
    id: flag.id,
    label: flag.label,
    severity: flag.severity,
  }));

  const rubric = {
    questionText: question.questionText,
    role: question.role,
    focus: question.focus,
    category: question.category,
    subcategory: question.subcategory,
    difficulty: question.difficulty,
    expectedConcepts,
    redFlags,
    sampleGoodAnswer: question.sampleGoodAnswer,
    minimumPassScore: question.minimumPassScore,
    outputLanguage: question.outputLanguage,
  };

  return `Evaluate the candidate's answer to one interview question.

Rubric (JSON):
${JSON.stringify(rubric)}

Candidate transcript:
"""
${transcriptText}
"""

Output a single JSON object with these camelCase keys:
- overallScore (number, 0-100): how well the answer covers the rubric.
- categoryScores: object with numeric 0-100 scores for "relevance", "depth", "communication".
- coveredConceptIds (string[]): subset of rubric.expectedConcepts[].id that the answer demonstrates.
- missedConceptIds (string[]): rubric.expectedConcepts[].id that the answer fails to address.
- redFlagIds (string[]): rubric.redFlags[].id that the answer triggers.
- summary (string): 1-3 sentences in ${responseLanguageName}, explaining the score.
- decisionHint: one of "pass" | "review" | "fail".
Use minimumPassScore as the boundary: scores at or above pass, clearly below fail, borderline review.
Do not invent concept ids — only use ids from the rubric.`;
}

function parseAnswerEvaluationShape(
  value: unknown,
): RawAnswerEvaluation | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const overallScore = value.overallScore;
  if (typeof overallScore !== 'number' || !Number.isFinite(overallScore)) {
    return undefined;
  }

  const decisionHint = value.decisionHint;
  if (
    decisionHint !== undefined &&
    decisionHint !== 'pass' &&
    decisionHint !== 'review' &&
    decisionHint !== 'fail'
  ) {
    return undefined;
  }

  if (
    value.categoryScores !== undefined &&
    (!isPlainRecord(value.categoryScores) ||
      Object.values(value.categoryScores).some(
        (score) => typeof score !== 'number' || !Number.isFinite(score),
      ))
  ) {
    return undefined;
  }

  const idListOk = (field: string): boolean => {
    const list = value[field];
    return (
      list === undefined ||
      (Array.isArray(list) && list.every((item) => typeof item === 'string'))
    );
  };

  if (
    !idListOk('coveredConceptIds') ||
    !idListOk('missedConceptIds') ||
    !idListOk('redFlagIds')
  ) {
    return undefined;
  }

  if (value.summary !== undefined && typeof value.summary !== 'string') {
    return undefined;
  }

  return value as RawAnswerEvaluation;
}

export async function evaluateAnswerWithNativeLlm(
  config: NativeProviderConfig,
  question: InterviewQuestion,
  transcriptText: string,
  interviewLocale: Locale,
): Promise<RawAnswerEvaluation> {
  const user = buildAnswerEvaluationUserPrompt(
    question,
    transcriptText,
    interviewLocale,
  );
  const raw = await completeJson(config, ANSWER_EVALUATION_SYSTEM, user);
  const parsed = parseAnswerEvaluationShape(parseJsonFromModelOutput(raw));
  if (!parsed) {
    throw new Error('LLM returned invalid answer evaluation JSON.');
  }
  return parsed;
}
