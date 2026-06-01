import { QuestionService } from './question.service';
import { resolveQuestion } from './resolve-question';
import { Question } from './interfaces/question.interface';

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
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
        questionText: 'Polish',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
    usageCount: 0,
    ...overrides,
  };
}

describe('list locale resolve', () => {
  it('resolves item fields for X-Locale', () => {
    const question = baseQuestion();
    const resolved = resolveQuestion(question, 'pl');

    expect(resolved.resolvedLocale).toBe('pl');
    expect(resolved.questionText).toBe('Polish');
    expect(resolved.availableLocales).toEqual(['en', 'pl']);
  });

  it('lists available locales for legacy-only rows', () => {
    const question = baseQuestion({
      translations: {},
      questionText: 'Legacy EN',
      primaryLocale: 'en',
    });
    const resolved = resolveQuestion(question, 'en');

    expect(resolved.questionText).toBe('Legacy EN');
    expect(resolved.availableLocales).toEqual(['en']);
  });
});

describe('toResolvedQuestion', () => {
  const service = Object.create(QuestionService.prototype) as QuestionService;

  it('omits translations by default', () => {
    const question = baseQuestion();
    const item = service.toResolvedQuestion(question, 'en');
    expect(item.translations).toBeUndefined();
    expect(item.resolvedLocale).toBe('en');
  });

  it('includes translations when requested', () => {
    const question = baseQuestion();
    const item = service.toResolvedQuestion(question, 'en', {
      includeTranslations: true,
    });
    expect(item.translations?.en?.questionText).toBe('English');
  });
});
