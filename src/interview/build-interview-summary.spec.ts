import { buildInterviewSummary } from './build-interview-summary';
import { InterviewQuestionResult } from './interfaces/interview.interface';

describe('buildInterviewSummary', () => {
  it('uses locale-specific labels when aggregating per-question summaries', () => {
    const summary = buildInterviewSummary(
      [
        {
          questionIndex: 0,
          questionId: 'q1',
          summary: 'Dobra odpowiedź.',
        },
      ],
      'pl',
    );

    expect(summary).toBe('P1: Dobra odpowiedź.');
  });

  it('returns a localized empty message when no summaries exist', () => {
    expect(buildInterviewSummary([], 'ru')).toContain('Нет');
  });
});
