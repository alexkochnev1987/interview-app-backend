import { buildAnswerEvaluationUserPrompt } from './answer-evaluation-llm';
import { InterviewQuestion } from '../../interview/interfaces/interview.interface';

const baseQuestion: InterviewQuestion = {
  id: 'q1',
  primaryLocale: 'en',
  translations: {},
  outputLanguage: 'English',
  questionText: 'What is NestJS?',
  followUpQuestions: [],
  expectedConcepts: [],
  redFlags: [],
  difficulty: 'medium',
  weight: 1,
  minimumPassScore: 60,
  tags: [],
  metadata: {},
};

describe('buildAnswerEvaluationUserPrompt', () => {
  it('requires summary in the interview locale language', () => {
    const prompt = buildAnswerEvaluationUserPrompt(
      baseQuestion,
      'transcript',
      'pl',
    );

    expect(prompt).toContain('1-3 sentences in Polish');
    expect(prompt).not.toContain('1-3 sentences in English');
  });
});
