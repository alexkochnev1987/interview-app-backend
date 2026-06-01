import { Question } from './interfaces/question.interface';
import { QuestionService } from './question.service';

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
      ru: {
        questionText: 'Russian',
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

describe('GET /questions/:id resolved (BE-009)', () => {
  const service = Object.create(QuestionService.prototype) as QuestionService;

  it('default detail shape matches list item (no translations map)', () => {
    const question = baseQuestion();
    const listItem = service.toResolvedQuestion(question, 'ru');
    const detail = service.toResolvedQuestion(question, 'ru');

    expect(detail.translations).toBeUndefined();
    expect(detail).toEqual(listItem);
    expect(detail.resolvedLocale).toBe('ru');
    expect(detail.questionText).toBe('Russian');
    expect(detail.availableLocales).toEqual(['en', 'ru']);
  });

  it('includeTranslations=true returns full map for editor', () => {
    const question = baseQuestion();
    const detail = service.toResolvedQuestion(question, 'en', {
      includeTranslations: true,
    });

    expect(detail.translations).toEqual(question.translations);
    expect(detail.questionText).toBe('English');
    expect(detail.resolvedLocale).toBe('en');
  });

  it('preserves deleted flag on resolved detail (super-admin read path)', () => {
    const question = baseQuestion({ deleted: true });
    const detail = service.toResolvedQuestion(question, 'en');

    expect(detail.deleted).toBe(true);
    expect(detail.translations).toBeUndefined();
  });
});
