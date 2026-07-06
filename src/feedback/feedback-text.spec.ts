import { buildFeedbackImprovements } from './feedback-text';
import { InterviewQuestionResult } from '../interview/interfaces/interview.interface';

function result(
  overrides: Partial<InterviewQuestionResult>,
): InterviewQuestionResult {
  return {
    questionIndex: 0,
    questionId: 'q1',
    ...overrides,
  };
}

describe('buildFeedbackImprovements', () => {
  it('returns undefined when all answers are strong', () => {
    expect(
      buildFeedbackImprovements(
        [result({ score: 85, decisionHint: 'pass', summary: 'Solid answer.' })],
        'en',
      ),
    ).toBeUndefined();
  });

  it('aggregates weak answers sorted by score', () => {
    const text = buildFeedbackImprovements(
      [
        result({
          questionIndex: 1,
          score: 55,
          decisionHint: 'review',
          summary: 'Missed key concepts.',
        }),
        result({
          questionIndex: 0,
          score: 40,
          decisionHint: 'fail',
          summary: 'Incomplete response.',
        }),
      ],
      'en',
    );

    expect(text).toContain('Question 1 (40%)');
    expect(text).toContain('Incomplete response.');
    expect(text).toMatch(/Question 2 \(55%\)/);
    expect(text!.indexOf('Question 1')).toBeLessThan(text!.indexOf('Question 2'));
  });

  it('uses Polish labels for pl interview locale', () => {
    const text = buildFeedbackImprovements(
      [
        result({
          questionIndex: 0,
          score: 50,
          decisionHint: 'review',
          summary: 'Brakuje szczegółów.',
        }),
      ],
      'pl',
    );

    expect(text).toContain('Pytanie 1');
    expect(text).toContain('Brakuje szczegółów.');
  });
});
