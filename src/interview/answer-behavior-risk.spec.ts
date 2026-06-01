import {
  compareBehaviorRisk,
  computeAnswerBehaviorRisk,
} from './answer-behavior-risk';
import type { AnswerBehaviorSignals } from './interfaces/interview.interface';

function signals(
  partial: Partial<AnswerBehaviorSignals>,
): AnswerBehaviorSignals {
  return {
    tabHiddenCount: 0,
    windowBlurCount: 0,
    pasteCount: 0,
    keydownCount: 0,
    copyCount: 0,
    resizeCount: 0,
    ...partial,
  };
}

describe('answer-behavior-risk', () => {
  it('scores low, medium, and high risk from signals and duration', () => {
    expect(computeAnswerBehaviorRisk(undefined, 60)).toBe('low');
    expect(computeAnswerBehaviorRisk(undefined, 10)).toBe('medium');
    expect(
      computeAnswerBehaviorRisk(signals({ tabHiddenCount: 2, pasteCount: 2 }), 60),
    ).toBe('high');
    expect(
      computeAnswerBehaviorRisk(
        signals({ tabHiddenCount: 1, windowBlurCount: 1 }),
        60,
      ),
    ).toBe('medium');
  });

  it('orders risk levels for aggregation', () => {
    expect(compareBehaviorRisk('low', 'high')).toBeLessThan(0);
    expect(compareBehaviorRisk('medium', 'medium')).toBe(0);
  });
});
