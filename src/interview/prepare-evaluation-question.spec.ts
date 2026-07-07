import { prepareQuestionForEvaluation } from './prepare-evaluation-question';
import { InterviewQuestion } from './interfaces/interview.interface';

function question(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    id: 'q1',
    primaryLocale: 'en',
    translations: {
      en: {
        questionText: 'English rubric',
        followUpQuestions: [],
        expectedConcepts: [
          { id: 'c1', label: 'EN concept', weight: 1, description: 'en' },
        ],
        redFlags: [],
      },
      pl: {
        questionText: 'Polska rubryka',
        followUpQuestions: [],
        expectedConcepts: [
          { id: 'c1', label: 'PL concept', weight: 1, description: 'pl' },
        ],
        redFlags: [],
      },
    },
    outputLanguage: 'English',
    questionText: 'English rubric',
    followUpQuestions: [],
    expectedConcepts: [
      { id: 'c1', label: 'EN concept', weight: 1, description: 'en' },
    ],
    redFlags: [],
    difficulty: 'medium',
    weight: 1,
    minimumPassScore: 0,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

describe('prepareQuestionForEvaluation', () => {
  it('resolves rubric fields and output language to interviewLocale', () => {
    const prepared = prepareQuestionForEvaluation(question(), 'pl');

    expect(prepared.questionText).toBe('Polska rubryka');
    expect(prepared.expectedConcepts[0]?.label).toBe('PL concept');
    expect(prepared.outputLanguage).toBe('Polish');
  });
});
