import type {
  AnswerBehaviorSignals,
  InterviewBehaviorRisk,
} from './interfaces/interview.interface';

const SHORT_ANSWER_THRESHOLD_SECONDS = 15;
const HIGH_RISK_THRESHOLD = 12;
const MEDIUM_RISK_THRESHOLD = 5;

export function computeAnswerBehaviorRisk(
  signals: AnswerBehaviorSignals | undefined,
  durationSeconds: number | undefined,
): InterviewBehaviorRisk {
  const tabHidden = signals?.tabHiddenCount ?? 0;
  const windowBlur = signals?.windowBlurCount ?? 0;
  const paste = signals?.pasteCount ?? 0;

  let score = tabHidden * 3 + windowBlur * 2 + paste * 5;
  if (typeof durationSeconds === 'number' && durationSeconds < SHORT_ANSWER_THRESHOLD_SECONDS) {
    score += 5;
  }

  if (score >= HIGH_RISK_THRESHOLD) {
    return 'high';
  }
  if (score >= MEDIUM_RISK_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}

export function compareBehaviorRisk(
  left: InterviewBehaviorRisk,
  right: InterviewBehaviorRisk,
): number {
  const order: Record<InterviewBehaviorRisk, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  return order[left] - order[right];
}
