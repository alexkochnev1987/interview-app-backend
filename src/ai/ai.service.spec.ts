import { AiService } from './ai.service';
import * as aiEnv from './llm/ai-env';
import * as questionDraftLlm from './llm/question-draft-llm';
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
    expect(draft.translations?.ru?.followUpQuestions?.[0]).toMatch(/[А-Яа-яЁё]/);
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
});
