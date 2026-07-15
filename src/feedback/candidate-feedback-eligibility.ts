import { getAnswerValidationSubmissionBlockReason } from '../interview/answer-validation-rules';
import {
  Answer,
  AnswerEvaluation,
  Interview,
  InterviewDecision,
  InterviewStatus,
} from '../interview/interfaces/interview.interface';
import { isTerminalInterviewStatus } from '../interview/interview-management-rules';

export const CANDIDATE_FEEDBACK_TERMINAL_INTERVIEW_MESSAGE =
  'Candidate feedback is only available after the interview is completed or failed';

/** Minimum trimmed transcript length (characters) to attempt feedback generation. */
export const CANDIDATE_FEEDBACK_MIN_TRANSCRIPT_LENGTH = 12;

/** Minimum count of Unicode letters required in a usable transcript. */
export const CANDIDATE_FEEDBACK_MIN_LETTER_COUNT = 8;

/** Minimum ratio of letters to non-whitespace characters in a usable transcript. */
export const CANDIDATE_FEEDBACK_MIN_LETTER_RATIO = 0.35;

/** overallScore / relevance at or above this → balanced when decisionHint is absent. */
export const CANDIDATE_FEEDBACK_HIGH_SCORE_THRESHOLD = 75;

/** Scores in [this, HIGH) with no fail hint → growth_focused. */
export const CANDIDATE_FEEDBACK_MEDIUM_SCORE_THRESHOLD = 55;

/** relevance / overallScore below this → honest_weak when decisionHint is absent. */
export const CANDIDATE_FEEDBACK_LOW_SCORE_THRESHOLD = 40;

/** YouTube / video outro closings and similar non-answer boilerplate (multilingual). */
const TRANSCRIPT_BOILERPLATE_PATTERNS: RegExp[] = [
  // English
  /subscribe\s+to\s+(the\s+)?channel/i,
  /like\s+and\s+subscribe/i,
  /thanks?\s+for\s+watching/i,
  /thank\s+you\s+for\s+watching/i,
  /see\s+you\s+(in\s+the\s+)?next\s+(video|one)/i,
  /smash\s+that\s+like\s+button/i,
  /hit\s+the\s+bell/i,
  /for\s+more\s+videos/i,
  // Turkish
  /[İi]zledi[ğg]iniz\s+i[çc]in\s+te[şs]ekk[uü]r/i,
  /te[şs]ekk[uü]r\s+ederim.*g[oö]r[uü][şs][uü]r[uü]z/i,
  /sonraki\s+videoda\s+g[oö]r[uü][şs][uü]r[uü]z/i,
  /bir\s+sonraki\s+videoda/i,
  // Russian
  /спасибо\s+за\s+просмотр/i,
  /до\s+встречи\s+в\s+следующем\s+видео/i,
  // Spanish
  /gracias\s+por\s+ver/i,
  /nos\s+vemos\s+en\s+el\s+pr[oó]ximo\s+video/i,
  // German
  /danke\s+(fürs?\s+)?(zu)?schauen/i,
  /bis\s+zum\s+nächsten\s+video/i,
  // Portuguese
  /obrigad[oa]\s+por\s+assistir/i,
  /^\s*[\W\d_]+\s*$/,
];

const OFF_TOPIC_SUMMARY_PATTERNS: RegExp[] = [
  /\boff[- ]topic\b/i,
  /\bdid\s+not\s+address\b/i,
  /\bdidn'?t\s+address\b/i,
  /\bunrelated\b/i,
  /\bnot\s+answer(ed)?\s+the\s+question\b/i,
  /\bfailed\s+to\s+address\b/i,
  // Russian
  /не\s+по\s+теме/i,
  /вне\s+темы/i,
  /не\s+отвечает\s+на\s+вопрос/i,
  /отвлечённ/i,
  /отвлеченн/i,
  // Turkish
  /konu\s+dışı/i,
  /konu\s+disi/i,
  /soruyu\s+yanıtlamad/i,
  /soruyu\s+yanitlamad/i,
  // Polish
  /nie\s+na\s+temat/i,
  /poza\s+tematem/i,
  // German
  /nicht\s+themenebezogen/i,
  /vom\s+thema\s+abweichend/i,
];

export type QuestionFeedbackGenerationSkipReason =
  | 'not_submitted'
  | 'missing_answer'
  | 'missing_transcript'
  | 'unusable_transcript'
  | 'missing_question';

export const QUESTION_FEEDBACK_ELIGIBILITY_SKIP_REASONS = [
  'not_submitted',
  'missing_answer',
  'missing_transcript',
  'unusable_transcript',
] as const;

export type QuestionFeedbackEligibilitySkipReason =
  (typeof QUESTION_FEEDBACK_ELIGIBILITY_SKIP_REASONS)[number];

export function isQuestionFeedbackEligibilitySkipReason(
  reason: string,
): reason is QuestionFeedbackEligibilitySkipReason {
  return (
    QUESTION_FEEDBACK_ELIGIBILITY_SKIP_REASONS as readonly string[]
  ).includes(reason);
}

export type QuestionFeedbackToneMode =
  | 'balanced'
  | 'growth_focused'
  | 'honest_weak'
  | 'transcript_only';

export type QuestionFeedbackGenerationClassification =
  | { action: 'skip'; reason: QuestionFeedbackGenerationSkipReason }
  | {
      action: 'generate';
      toneMode: QuestionFeedbackToneMode;
      transcriptText: string;
    };

export function getCandidateFeedbackInterviewStatusBlockReason(
  status: InterviewStatus,
): string | null {
  return isTerminalInterviewStatus(status)
    ? null
    : CANDIDATE_FEEDBACK_TERMINAL_INTERVIEW_MESSAGE;
}

export function countTranscriptLetters(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

export function transcriptLetterRatio(text: string): number {
  const compact = text.replace(/\s+/g, '');
  if (compact.length === 0) {
    return 0;
  }
  return countTranscriptLetters(text) / compact.length;
}

/** Remainder after stripping boilerplate must be at least this long to count as substantive. */
const BOILERPLATE_REMAINDER_MIN_LENGTH = 20;

function isSubstantiveTranscriptCore(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < CANDIDATE_FEEDBACK_MIN_TRANSCRIPT_LENGTH) {
    return false;
  }
  if (countTranscriptLetters(trimmed) < CANDIDATE_FEEDBACK_MIN_LETTER_COUNT) {
    return false;
  }
  if (transcriptLetterRatio(trimmed) < CANDIDATE_FEEDBACK_MIN_LETTER_RATIO) {
    return false;
  }
  return true;
}

function isSubstantiveBoilerplateRemainder(remainder: string): boolean {
  const trimmed = remainder.trim();
  if (trimmed.length < BOILERPLATE_REMAINDER_MIN_LENGTH) {
    return false;
  }
  return isSubstantiveTranscriptCore(trimmed);
}

function normalizeBoilerplateText(text: string): string {
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr');
}

function textMatchesBoilerplatePattern(text: string, pattern: RegExp): boolean {
  if (pattern.source.startsWith('^')) {
    return pattern.test(text);
  }
  return pattern.test(normalizeBoilerplateText(text));
}

function stripBoilerplatePhrases(text: string): string {
  let result = text;
  for (const pattern of TRANSCRIPT_BOILERPLATE_PATTERNS) {
    if (pattern.source.startsWith('^')) {
      continue;
    }
    const normalized = normalizeBoilerplateText(result);
    if (!textMatchesBoilerplatePattern(result, pattern)) {
      continue;
    }
    result = normalized.replace(
      new RegExp(pattern.source, pattern.flags.replace('g', '')),
      ' ',
    );
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function isObviousTranscriptBoilerplate(text: string): boolean {
  const trimmed = text.trim();
  if (/^\s*[\W\d_]+\s*$/.test(trimmed)) {
    return true;
  }

  const sentences = trimmed
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length === 0) {
    return true;
  }

  const hasSubstantiveSentence = sentences.some((sentence) => {
    if (
      TRANSCRIPT_BOILERPLATE_PATTERNS.some((pattern) =>
        textMatchesBoilerplatePattern(sentence, pattern),
      )
    ) {
      const remainder = stripBoilerplatePhrases(sentence);
      return Boolean(remainder) && isSubstantiveBoilerplateRemainder(remainder);
    }
    return isSubstantiveTranscriptCore(sentence);
  });

  return !hasSubstantiveSentence;
}

export function isUnusableTranscript(text: string | undefined): boolean {
  const trimmed = text?.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.length < CANDIDATE_FEEDBACK_MIN_TRANSCRIPT_LENGTH) {
    return true;
  }
  const letterCount = countTranscriptLetters(trimmed);
  if (letterCount < CANDIDATE_FEEDBACK_MIN_LETTER_COUNT) {
    return true;
  }
  if (transcriptLetterRatio(trimmed) < CANDIDATE_FEEDBACK_MIN_LETTER_RATIO) {
    return true;
  }
  if (isObviousTranscriptBoilerplate(trimmed)) {
    return true;
  }
  return false;
}

function hasUsableEvaluation(evaluation: AnswerEvaluation | undefined): boolean {
  if (!evaluation) {
    return false;
  }
  return (
    evaluation.decisionHint !== undefined ||
    evaluation.overallScore !== undefined ||
    Boolean(evaluation.summary?.trim()) ||
    (evaluation.categoryScores !== undefined &&
      Object.keys(evaluation.categoryScores).length > 0)
  );
}

function resolvePrimaryScore(evaluation: AnswerEvaluation | undefined): number | undefined {
  if (!evaluation) {
    return undefined;
  }
  const relevance = evaluation.categoryScores?.relevance;
  if (typeof relevance === 'number') {
    return relevance;
  }
  return evaluation.overallScore;
}

function evaluationSummarySuggestsOffTopic(
  evaluation: AnswerEvaluation | undefined,
): boolean {
  const summary = evaluation?.summary?.trim();
  if (!summary) {
    return false;
  }
  return OFF_TOPIC_SUMMARY_PATTERNS.some((pattern) => pattern.test(summary));
}

export function classifyQuestionFeedbackToneMode(
  answer: Pick<Answer, 'evaluation' | 'validation'>,
): QuestionFeedbackToneMode {
  const evaluation = answer.evaluation;

  if (!hasUsableEvaluation(evaluation)) {
    return 'transcript_only';
  }

  if (evaluation?.decisionHint === 'fail') {
    return 'honest_weak';
  }

  const primaryScore = resolvePrimaryScore(evaluation);
  if (
    primaryScore !== undefined &&
    primaryScore < CANDIDATE_FEEDBACK_LOW_SCORE_THRESHOLD
  ) {
    return 'honest_weak';
  }

  if (evaluationSummarySuggestsOffTopic(evaluation)) {
    return 'honest_weak';
  }

  if (evaluation?.decisionHint === 'review') {
    return 'growth_focused';
  }

  if (evaluation?.decisionHint === 'pass') {
    return 'balanced';
  }

  if (
    primaryScore !== undefined &&
    primaryScore < CANDIDATE_FEEDBACK_HIGH_SCORE_THRESHOLD
  ) {
    return 'growth_focused';
  }

  if (
    primaryScore !== undefined &&
    primaryScore >= CANDIDATE_FEEDBACK_HIGH_SCORE_THRESHOLD
  ) {
    return 'balanced';
  }

  return 'growth_focused';
}

export function classifyQuestionFeedbackGeneration(
  interview: Pick<Interview, 'questions'>,
  answer: Answer | undefined,
  questionIndex: number,
): QuestionFeedbackGenerationClassification {
  if (!interview.questions[questionIndex]) {
    return { action: 'skip', reason: 'missing_question' };
  }

  if (!answer) {
    return { action: 'skip', reason: 'missing_answer' };
  }

  const submissionBlock = getAnswerValidationSubmissionBlockReason(
    questionIndex,
    answer,
  );
  if (submissionBlock) {
    return { action: 'skip', reason: 'not_submitted' };
  }

  const rawTranscript = answer.transcript?.text;
  if (!rawTranscript?.trim()) {
    return { action: 'skip', reason: 'missing_transcript' };
  }

  const transcriptText = rawTranscript.trim();
  if (isUnusableTranscript(transcriptText)) {
    return { action: 'skip', reason: 'unusable_transcript' };
  }

  return {
    action: 'generate',
    toneMode: classifyQuestionFeedbackToneMode(answer),
    transcriptText,
  };
}

export type OverallFeedbackToneMode = 'balanced' | 'growth_focused' | 'honest_weak';

/** Decision-only fallback when no per-question blocks are available yet. */
export function classifyOverallFeedbackToneMode(
  decision: InterviewDecision | undefined,
): OverallFeedbackToneMode {
  if (decision === 'reject') {
    return 'honest_weak';
  }
  if (decision === 'review') {
    return 'growth_focused';
  }
  return 'balanced';
}
