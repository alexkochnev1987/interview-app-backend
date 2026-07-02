import { resolveQuestion, ResolveQuestionInput } from './resolve-question';

function baseQuestion(overrides: Partial<ResolveQuestionInput> = {}): ResolveQuestionInput {
  return {
    primaryLocale: 'en',
    questionText: 'English question',
    followUpQuestions: ['English follow-up'],
    expectedConcepts: [
      { id: 'en_concept', label: 'English concept', weight: 1, description: 'en' },
    ],
    redFlags: [{ id: 'en_flag', label: 'English flag', severity: 'medium' }],
    sampleGoodAnswer: 'English sample',
    translations: {
      en: {
        questionText: 'English question',
        followUpQuestions: ['English follow-up'],
        expectedConcepts: [
          { id: 'en_concept', label: 'English concept', weight: 1, description: 'en' },
        ],
        redFlags: [{ id: 'en_flag', label: 'English flag', severity: 'medium' }],
        sampleGoodAnswer: 'English sample',
      },
    },
    ...overrides,
  };
}

describe('resolveQuestion rubric locale bundle', () => {
  it('uses the primary rubric bundle when the resolved locale block is partial', () => {
    const question = baseQuestion({
      translations: {
        en: {
          questionText: 'English question',
          followUpQuestions: ['English follow-up'],
          expectedConcepts: [
            { id: 'en_concept', label: 'English concept', weight: 1, description: 'en' },
          ],
          redFlags: [{ id: 'en_flag', label: 'English flag', severity: 'medium' }],
          sampleGoodAnswer: 'English sample',
        },
        pl: {
          questionText: 'Polish question',
          followUpQuestions: ['Polish follow-up only'],
        },
      },
    });

    const result = resolveQuestion(question, 'pl');

    expect(result.questionText).toBe('Polish question');
    expect(result.followUpQuestions).toEqual(['English follow-up']);
    expect(result.expectedConcepts[0]?.label).toBe('English concept');
    expect(result.fallbackFromLocale).toBe('pl');
  });
});
