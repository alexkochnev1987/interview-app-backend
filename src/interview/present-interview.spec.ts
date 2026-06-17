import { presentInterview } from './present-interview';
import { Interview } from './interfaces/interview.interface';

describe('presentInterview', () => {
  it('resolves questions in interviewLocale (not X-Locale)', () => {
    const interview: Interview = {
      id: 'i1',
      candidateName: 'Test',
      position: 'Dev',
      interviewLocale: 'en',
      questions: [
        {
          id: 'q1',
          primaryLocale: 'en',
          translations: {
            en: {
              questionText: 'English',
              followUpQuestions: [],
              expectedConcepts: [],
              redFlags: [],
            },
            pl: {
              questionText: 'Polski',
              followUpQuestions: [],
              expectedConcepts: [],
              redFlags: [],
            },
          },
          outputLanguage: 'English',
          questionText: 'English',
          followUpQuestions: [],
          expectedConcepts: [],
          redFlags: [],
          difficulty: 'medium',
          weight: 1,
          minimumPassScore: 0,
          tags: [],
          metadata: {},
        },
      ],
      answers: [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const presented = presentInterview(interview);

    expect(presented.questionsDisplayLocale).toBe('en');
    expect(presented.interviewLocale).toBe('en');
    expect(presented.questions[0]?.questionText).toBe('English');
    expect(presented.questions[0]?.resolvedLocale).toBe('en');
  });
});
