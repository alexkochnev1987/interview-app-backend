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

    expect(draft.primaryLocale).toBe('ru');
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
    expect(draftRubricMatchesLocale(draft, 'ru')).toBe(true);
    expect(draft.followUpQuestions[0]).toMatch(/[А-Яа-яЁё]/);
    expect(draft.expectedConcepts[0].label).toMatch(/[А-Яа-яЁё]/);
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
