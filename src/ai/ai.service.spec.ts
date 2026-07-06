import { AiService } from './ai.service';
import * as aiEnv from './llm/ai-env';
import * as questionDraftLlm from './llm/question-draft-llm';
import * as translateDraftLlm from './llm/question-draft-translate-llm';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import {
  collectRubricHumanReadableTexts,
  conceptAndRedFlagIdsAreLatinSnakeCase,
  draftRubricMatchesLocale,
  rubricTextsMatchLocale,
} from './question-draft-rubric-locale';
import { QuestionDraftContent, QuestionDraftGenerate } from './question-draft-content';

function assertGenerateDraft(
  draft: QuestionDraftGenerate | QuestionDraftContent,
): asserts draft is QuestionDraftGenerate {
  expect('primaryLocale' in draft).toBe(false);
}

function assertTranslateDraft(
  draft: QuestionDraftGenerate | QuestionDraftContent,
): asserts draft is QuestionDraftContent {
  expect('primaryLocale' in draft).toBe(true);
}

describe('draftRubricMatchesLocale', () => {
  it('does not treat Russian questionText alone as matching ru rubric', () => {
    const rubricOnly = collectRubricHumanReadableTexts({
      followUpQuestions: ['Can you give a simple practical example?'],
      expectedConcepts: [
        {
          id: 'concept_1',
          label: 'clear reasoning',
          weight: 1,
          description: 'should be explicitly covered',
        },
      ],
      redFlags: [{ id: 'red_flag_1', label: 'Generic answer', severity: 'medium' }],
      sampleGoodAnswer: 'A strong answer should explain the idea in simple terms.',
    });

    expect(rubricTextsMatchLocale('ru', rubricOnly)).toBe(false);
    expect(rubricTextsMatchLocale('ru', ['замыкание', ...rubricOnly])).toBe(true);
  });

  it('requires Belarusian glyphs for be locale', () => {
    const russianOnly = ['Объясните замыкания в JavaScript.'];
    const belarusian = ['Растлумачце замыканні ў JavaScript.'];

    expect(rubricTextsMatchLocale('be', russianOnly)).toBe(false);
    expect(rubricTextsMatchLocale('be', belarusian)).toBe(true);
    expect(rubricTextsMatchLocale('ru', russianOnly)).toBe(true);
  });
});

describe('AiService.draftQuestion', () => {
  const service = new AiService();
  const fullRuPrimary = {
    questionText: 'Что такое DOM?',
    primaryLocale: 'ru' as const,
    followUpQuestions: ['Можете привести пример?', 'Какую ошибку избегаете?'],
    expectedConcepts: [
      { id: 'dom_model', label: 'модель DOM', weight: 0.34, description: 'структура' },
      { id: 'rendering', label: 'отрисовка', weight: 0.33, description: 'обновления' },
      { id: 'practical_use', label: 'практика', weight: 0.33, description: 'пример' },
    ],
    redFlags: [
      { id: 'confuses_dom', label: 'Путает DOM', severity: 'medium' as const },
      { id: 'no_example', label: 'Нет примера', severity: 'high' as const },
    ],
    sampleGoodAnswer: 'DOM — объектная модель документа в браузере.',
  };
  const envBackup = {
    AI_API_URL: process.env.AI_API_URL,
    AI_PROVIDER: process.env.AI_PROVIDER,
  };

  beforeEach(() => {
    delete process.env.AI_API_URL;
    delete process.env.AI_PROVIDER;
    jest.restoreAllMocks();
    jest.spyOn(aiEnv, 'resolveNativeProvider').mockReturnValue(null);
  });

  afterAll(() => {
    if (envBackup.AI_API_URL !== undefined) {
      process.env.AI_API_URL = envBackup.AI_API_URL;
    } else {
      delete process.env.AI_API_URL;
    }
    if (envBackup.AI_PROVIDER !== undefined) {
      process.env.AI_PROVIDER = envBackup.AI_PROVIDER;
    } else {
      delete process.env.AI_PROVIDER;
    }
  });

  it('locale ru + «замыкание» → Russian rubric and Latin ids (body.locale wins)', async () => {
    const draft = await service.draftQuestion(
      {
        questionText: 'замыкание',
        primaryLocale: 'ru',
        outputLanguage: 'English',
      },
      { bodyLocale: 'ru', headerLocale: 'en' },
    );

    assertGenerateDraft(draft);
    expect(draft.category).toBeTruthy();
    expect(draft.externalId).toBeTruthy();
    expect(draftRubricMatchesLocale(draft, 'ru')).toBe(true);
    expect(draft.followUpQuestions.length).toBeGreaterThanOrEqual(2);
    expect(draft.followUpQuestions[0]).toMatch(/[А-Яа-яЁё]/);
    expect(draft.expectedConcepts[0].description).toMatch(/[А-Яа-яЁё]/);
    expect(draft.redFlags[0].label).toMatch(/[А-Яа-яЁё]/);
    expect(draft.sampleGoodAnswer).toMatch(/[А-Яа-яЁё]/);
    expect(conceptAndRedFlagIdsAreLatinSnakeCase(draft)).toBe(true);
  });

  it('rejects English LLM rubric for locale ru and falls back to localized heuristic', async () => {
    jest.spyOn(aiEnv, 'resolveNativeProvider').mockReturnValue({
      kind: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
    });
    const generate = jest
      .spyOn(questionDraftLlm, 'generateQuestionDraftWithNativeLlm')
      .mockResolvedValue({
        externalId: 'javascript_closures_v1',
        role: 'junior engineer',
        focus: 'fundamentals',
        outputLanguage: 'English',
        category: 'javascript',
        subcategory: 'closures',
        questionText: 'замыкание',
        followUpQuestions: [
          'Can you give a simple practical example?',
          'What common mistake would you avoid?',
        ],
        expectedConcepts: [
          {
            id: 'scope_chain',
            label: 'scope chain',
            weight: 0.34,
            description: 'should be covered explicitly',
          },
          {
            id: 'lexical_env',
            label: 'lexical environment',
            weight: 0.33,
            description: 'explain binding',
          },
          {
            id: 'practical_use',
            label: 'practical use',
            weight: 0.33,
            description: 'give a real example',
          },
        ],
        redFlags: [
          { id: 'confuses_scope', label: 'Confuses scope', severity: 'medium' },
          { id: 'no_example', label: 'No example', severity: 'high' },
        ],
        difficulty: 'easy',
        weight: 1,
        sampleGoodAnswer:
          'A strong answer explains closures in simple terms and gives one example.',
        minimumPassScore: 2.5,
        tags: ['javascript', 'closures', 'fundamentals'],
        metadata: {},
      });

    const draft = await service.draftQuestion(
      { questionText: 'замыкание' },
      { bodyLocale: 'ru', headerLocale: 'ru' },
    );

    expect(generate).toHaveBeenCalled();
    assertGenerateDraft(draft);
    expect(draftRubricMatchesLocale(draft, 'ru')).toBe(true);
    expect(draft.followUpQuestions[0]).toMatch(/[А-Яа-яЁё]/);
    expect(draft.expectedConcepts[0].label).toMatch(/[А-Яа-яЁё]/);
  });

  it('generate mode returns identity fields from LLM when rubric locale matches', async () => {
    jest.spyOn(aiEnv, 'resolveNativeProvider').mockReturnValue({
      kind: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
    });
    jest.spyOn(questionDraftLlm, 'generateQuestionDraftWithNativeLlm').mockResolvedValue({
      externalId: 'javascript_closures_v1',
      role: 'junior engineer',
      focus: 'fundamentals',
      category: 'javascript',
      subcategory: 'closures',
      questionText: 'Объясните замыкания в JavaScript.',
      followUpQuestions: [
        'Можете привести простой практический пример?',
        'Какую типичную ошибку вы бы избегали?',
      ],
      expectedConcepts: [
        {
          id: 'scope_chain',
          label: 'цепочка областей видимости',
          weight: 0.34,
          description: 'должна быть явно раскрыта',
        },
        {
          id: 'lexical_env',
          label: 'лексическое окружение',
          weight: 0.33,
          description: 'объяснить привязку',
        },
        {
          id: 'practical_use',
          label: 'практическое применение',
          weight: 0.33,
          description: 'привести реальный пример',
        },
      ],
      redFlags: [
        { id: 'confuses_scope', label: 'Путает область видимости', severity: 'medium' },
        { id: 'no_example', label: 'Нет примера', severity: 'high' },
      ],
      difficulty: 'easy',
      weight: 1,
      sampleGoodAnswer:
        'Сильный ответ объясняет замыкания простыми словами и приводит один пример.',
      minimumPassScore: 2.5,
      tags: ['javascript', 'closures', 'fundamentals'],
    });

    const draft = await service.draftQuestion(
      { questionText: 'замыкание', primaryLocale: 'ru' },
      { bodyLocale: 'ru', headerLocale: 'ru', mode: 'generate' },
    );

    assertGenerateDraft(draft);
    expect(draft.externalId).toBe('javascript_closures_v1');
    expect(draft.role).toBe('junior engineer');
    expect(draft.category).toBe('javascript');
    expect(draft.difficulty).toBe('easy');
    expect(draft.tags).toEqual(['javascript', 'closures', 'fundamentals']);
    expect(draft.questionText).toContain('замыкания');
  });

  it('translate mode uses native LLM for full content block', async () => {
    jest.spyOn(aiEnv, 'resolveNativeProvider').mockReturnValue({
      kind: 'google',
      apiKey: 'AQ.test-key',
      model: 'gemini-2.5-flash-lite',
    });
    const translate = jest
      .spyOn(translateDraftLlm, 'translateQuestionContentWithNativeLlm')
      .mockResolvedValue({
        questionText: 'Co to jest DOM?',
        followUpQuestions: ['Przykład?', 'Błąd?'],
        expectedConcepts: [
          { id: 'dom_model', label: 'model DOM', weight: 0.34, description: 'struktura' },
          { id: 'rendering', label: 'odświeżanie', weight: 0.33, description: 'aktualizacje' },
          { id: 'practical_use', label: 'praktyka', weight: 0.33, description: 'przykład' },
        ],
        redFlags: [
          { id: 'confuses_dom', label: 'Myli DOM', severity: 'medium' },
          { id: 'no_example', label: 'Brak przykładu', severity: 'high' },
        ],
        sampleGoodAnswer: 'DOM to model dokumentu w przeglądarce.',
      });

    const draft = await service.draftQuestion(fullRuPrimary, {
      bodyLocale: 'pl',
      headerLocale: 'pl',
      mode: 'translate',
    });

    expect(draft.questionText).toBe('Co to jest DOM?');
    expect(translate).toHaveBeenCalled();
    assertTranslateDraft(draft);
    expect(draft.primaryLocale).toBe('pl');
  });

  it('translate mode returns 503 when AI returns unusable content', async () => {
    process.env.AI_API_URL = 'http://fake-ai.local';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ questionText: fullRuPrimary.questionText }),
    } as Response);

    await expect(
      service.draftQuestion(fullRuPrimary, {
        bodyLocale: 'pl',
        headerLocale: 'pl',
        mode: 'translate',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ApiErrorCode.SERVICE_UNAVAILABLE,
      },
      status: 503,
    });
  });
});
