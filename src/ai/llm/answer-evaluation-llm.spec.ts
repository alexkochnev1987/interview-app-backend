import type { InterviewQuestion } from '../../interview/interfaces/interview.interface';
import { buildAnswerEvaluationUserPrompt } from './answer-evaluation-llm';

function question(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    id: 'q1',
    outputLanguage: 'English',
    questionText: 'Explain event loop',
    followUpQuestions: [],
    expectedConcepts: [
      {
        id: 'c1',
        label: 'Call stack',
        weight: 1,
        description: 'LIFO execution',
      },
    ],
    redFlags: [{ id: 'rf1', label: 'No examples', severity: 'medium' }],
    difficulty: 'medium',
    weight: 1,
    minimumPassScore: 60,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

describe('answer-evaluation-llm', () => {
  describe('buildAnswerEvaluationUserPrompt', () => {
    it('embeds rubric concept ids and transcript', () => {
      const prompt = buildAnswerEvaluationUserPrompt(
        question(),
        'The call stack runs synchronously.',
      );

      expect(prompt).toContain('Explain event loop');
      expect(prompt).toContain('"c1"');
      expect(prompt).toContain('"rf1"');
      expect(prompt).toContain('The call stack runs synchronously.');
      expect(prompt).toContain('minimumPassScore');
    });
  });
});
