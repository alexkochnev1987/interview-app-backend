import { resolveInterviewQuestion } from './resolve-interview-question';
import { InterviewQuestion } from './interfaces/interview.interface';

function question(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    id: 'q1',
    primaryLocale: 'en',
    translations: {
      en: {
        questionText: 'English snapshot',
        followUpQuestions: [],
        expectedConcepts: [],
        redFlags: [],
      },
      pl: {
        questionText: 'Polski snapshot',
        followUpQuestions: ['Dodatkowe pytanie'],
        expectedConcepts: [],
        redFlags: [],
      },
    },
    outputLanguage: 'English',
    questionText: 'English snapshot',
    followUpQuestions: [],
    expectedConcepts: [],
    redFlags: [],
    difficulty: 'medium',
    weight: 1,
    minimumPassScore: 0,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

describe('resolveInterviewQuestion', () => {
  it('resolves interview snapshot rubric for X-Locale', () => {
    const resolved = resolveInterviewQuestion(question(), 'pl');

    expect(resolved.questionText).toBe('Polski snapshot');
    expect(resolved.followUpQuestions).toEqual(['Dodatkowe pytanie']);
    expect(resolved.resolvedLocale).toBe('pl');
    expect(resolved.availableLocales).toContain('pl');
  });
});
